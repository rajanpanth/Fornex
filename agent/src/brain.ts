import OpenAI from "openai";
import { truncateReasoning } from "./config";
import type { AgentVote, AgentVotes, ConsensusDecision, MarketSignals } from "./types";

const currentPositionDefault = "NONE";

const SYSTEM_PROMPTS = {
  bull: `You are BULL, a momentum perp trader on Solana.
You favor entering trades when momentum is strong.
You look for: negative funding rate (shorts overcrowded = likely reversal UP), rising open interest (new money entering), long/short ratio below 1.2 (not yet overcrowded long side), price above key levels. You prefer LONG bias. Max leverage 3x.
Be decisive - sitting flat costs opportunity.`,
  bear: `You are BEAR, a contrarian perp trader on Solana.
You fade crowded trades and look for reversals.
You look for: extreme long/short ratio above 1.6 (longs overcrowded = due for squeeze), positive funding (longs overextended and paying), large mark/index spread (price stretched). You prefer SHORT or FLAT. Max leverage 2x.
Protect capital first - be skeptical of momentum.`,
  zen: `You are ZEN, a risk-focused perp trader on Solana.
You only trade when risk/reward is clearly favorable.
You look for: low volatility entry points, clear liquidation wall as support/resistance, tight mark/index spread (stable), OI not spiking erratically. You prefer FLAT unless setup is pristine. Max leverage 1.5x. Never chase. Capital preservation is your top priority.`,
};

export async function getAgentVotes(
  signals: MarketSignals,
  currentPosition = currentPositionDefault
): Promise<AgentVotes> {
  const [bull, bear, zen] = await Promise.all([
    askAgent("bull", SYSTEM_PROMPTS.bull, signals, currentPosition),
    askAgent("bear", SYSTEM_PROMPTS.bear, signals, currentPosition),
    askAgent("zen", SYSTEM_PROMPTS.zen, signals, currentPosition),
  ]);

  return { bull, bear, zen };
}

export function getConsensus(votes: AgentVotes): ConsensusDecision {
  const all = [votes.bull, votes.bear, votes.zen];
  const counts = {
    LONG: all.filter((vote) => vote.direction === "LONG").length,
    SHORT: all.filter((vote) => vote.direction === "SHORT").length,
    FLAT: all.filter((vote) => vote.direction === "FLAT").length,
  };
  const direction =
    counts.LONG >= 2 ? "LONG" : counts.SHORT >= 2 ? "SHORT" : counts.FLAT >= 2 ? "FLAT" : "FLAT";
  const agreeing = all.filter((vote) => vote.direction === direction);
  const dissenting = all.filter((vote) => vote.direction !== direction);
  const agreeingCount = agreeing.length;
  const leverage =
    agreeingCount > 0
      ? agreeing.reduce((sum, vote) => sum + vote.leverage, 0) / agreeingCount
      : 1;

  // Weight: agreeing agents count double, dissenters count half.
  // Unanimous decisions register higher confidence than split majorities.
  const numerator =
    agreeing.reduce((s, v) => s + v.confidence * 2, 0) +
    dissenting.reduce((s, v) => s + v.confidence * 0.5, 0);
  const denominator = agreeingCount * 2 + dissenting.length * 0.5;
  const weighted = denominator > 0 ? numerator / denominator : 0;
  const confidence = Math.round(Math.min(100, Math.max(0, weighted)));

  return {
    direction,
    leverage: Math.min(3, Number(leverage.toFixed(2))),
    confidence,
    reasoning: truncateReasoning(`${agreeingCount}/3 agents agree on ${direction}`),
    shouldExecute: direction !== "FLAT" && confidence > 65,
    agreeingCount,
  };
}

async function askAgent(
  name: keyof typeof SYSTEM_PROMPTS,
  system: string,
  signals: MarketSignals,
  currentPosition: string
): Promise<AgentVote> {
  try {
    const client = createAzureClient();
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Market data for SOL-PERP on Drift Protocol:
- Funding rate: ${signals.fundingRate}% per hour
- Open interest change (1hr): ${signals.oiChange}%
- Long/Short ratio: ${signals.lsRatio}
- Mark vs Index spread: ${signals.markIndexSpread}%
- Nearest liquidation wall: $${signals.liqWallPrice}
- Current SOL price: $${signals.currentPrice}
- Current vault position: ${currentPosition}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "direction": "LONG or SHORT or FLAT",
  "leverage": "number between 1 and 3",
  "confidence": "number between 0 and 100",
  "reasoning": "string under 180 characters explaining why"
}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    return normalizeVote(JSON.parse(content), name);
  } catch (error) {
    console.warn(`[brain] ${name} failed; using safe FLAT vote`, error);
    return {
      direction: "FLAT",
      leverage: 1,
      confidence: 50,
      reasoning: `${name.toUpperCase()} unavailable; defaulting flat`,
    };
  }
}

function createAzureClient(): OpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI env vars missing");
  }

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${
      process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"
    }`,
    defaultQuery: { "api-version": "2024-08-01-preview" },
    defaultHeaders: { "api-key": apiKey },
  });
}

function normalizeVote(raw: any, name: keyof typeof SYSTEM_PROMPTS): AgentVote {
  const direction =
    raw.direction === "LONG" || raw.direction === "SHORT" || raw.direction === "FLAT"
      ? raw.direction
      : "FLAT";
  const maxLeverage = name === "zen" ? 1.5 : name === "bear" ? 2 : 3;

  return {
    direction,
    leverage: Math.min(maxLeverage, Math.max(1, Number(raw.leverage) || 1)),
    confidence: Math.min(100, Math.max(0, Math.round(Number(raw.confidence) || 0))),
    reasoning: truncateReasoning(String(raw.reasoning || "No reasoning provided")),
  };
}

