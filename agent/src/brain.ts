import OpenAI from "openai";
import { truncateReasoning } from "./config";
import type { AgentVote, AgentVotes, ConsensusDecision, MarketSignals, StrategyMode } from "./types";

const currentPositionDefault = "NONE";

/**
 * Strategy-mode-aware system prompts.
 *
 * Each mode is a tuple of three system prompts: BULL, BEAR, ZEN. The agent
 * selects a mode at the top of every cycle by reading the `VaultStrategy`
 * PDA on-chain (see `agent/src/strategyMode.ts`) — admin can switch modes
 * with `set_strategy_mode` and the change is observable on Explorer.
 *
 * Modes:
 *   - momentum   : trend follow with squeeze bias (current default).
 *   - meanRevert : fade overextensions, weight on mark/index spread + L/S.
 *   - rangeDCA   : staged entries inside ranges, exit on regime break.
 */
const PROMPTS_BY_MODE: Record<StrategyMode, { bull: string; bear: string; zen: string }> = {
  momentum: {
    bull: `You are BULL, a momentum perp trader on Solana. Max leverage 3x.
You favor LONG entries when momentum or mean-reversion conditions are present.
Decision rules:
- If funding < 0%/hr OR open-interest change > +5% in 1h → LONG with 1.5–2x leverage and confidence 65–80%.
- If long/short ratio > 2.0 AND funding > 0% → LONG (squeeze thesis), 1x leverage, confidence 60–70%.
- If long/short ratio is 1.0–1.6 with rising OI → LONG 1.5x at 60–70%.
- Reserve FLAT only for genuinely directionless markets where |funding| < 0.005% AND |OI Δ| < 1%.
Output JSON only, no markdown.`,
    bear: `You are BEAR, a contrarian perp trader. Max leverage 2x.
You fade crowded conditions.
Decision rules:
- If long/short ratio > 1.6 OR funding > 0.02%/hr → SHORT with 1.5x leverage and confidence 65–80%.
- If mark/index spread > 0.2% → SHORT (mean-reversion), 1x leverage, confidence 60–70%.
- Reserve FLAT only when shorts are also crowded (long/short ratio < 0.7).
You are a real contrarian. Do not default to FLAT.
Output JSON only, no markdown.`,
    zen: `You are ZEN, the risk-focused tiebreaker. Max leverage 2x.
You pick a side when BULL and BEAR disagree, with low leverage.
Decision rules:
- In tied or marginal regimes, pick the side with closer liquidation-wall support.
- Confidence 55–75% on chosen sides.
- FLAT only when mark/index spread > 1% (genuinely chaotic) OR confidence under 55%.
Lean toward action with low leverage rather than abstaining.
Output JSON only, no markdown.`,
  },

  meanRevert: {
    bull: `You are BULL operating in MEAN-REVERT mode. Max leverage 2x.
You buy local lows, not breakouts.
Decision rules:
- If mark/index spread < -0.2% (mark cheap to index) → LONG 1.5x at 65–80% confidence.
- If long/short ratio < 0.7 AND funding < 0% → LONG (squeeze thesis), 1.5x, 60–75%.
- If price is within 1% of nearest down liquidation wall → LONG 1x at 60–70% (wall as support).
- FLAT when there's no clear extension to fade (|spread| < 0.05% AND L/S in 0.9–1.1).
Output JSON only, no markdown.`,
    bear: `You are BEAR operating in MEAN-REVERT mode. Max leverage 2x.
You sell local highs.
Decision rules:
- If mark/index spread > 0.2% (mark rich to index) → SHORT 1.5x at 65–80% confidence.
- If long/short ratio > 1.5 AND funding > 0.01%/hr → SHORT 1.5x, 60–75%.
- Stay BEAR-biased. FLAT only when mark/index spread is symmetric and small.
Output JSON only, no markdown.`,
    zen: `You are ZEN in MEAN-REVERT mode. Max leverage 1x.
You only act on mean-revert signals with strong oracle confirmation.
Decision rules:
- If |mark/index spread| > 0.3% AND |L/S deviation from 1.0| > 0.4 → take the contrarian side at 1x, 55–70%.
- Otherwise FLAT. This regime is conservative by design.
Output JSON only, no markdown.`,
  },

  rangeDCA: {
    bull: `You are BULL operating in RANGE-DCA mode. Max leverage 1.5x.
You stage long entries in defined ranges, not chase momentum.
Decision rules:
- If price is within 2% of nearest down liquidation wall AND funding ≤ 0% → LONG 1x at 60–75%.
- If price is in the lower half of a tight range (mark/index spread small, L/S near 1) → LONG 1x at 55–65%.
- FLAT when price is in the upper half of the range or breaking out (avoid chase).
Output JSON only, no markdown.`,
    bear: `You are BEAR operating in RANGE-DCA mode. Max leverage 1.5x.
You stage short entries in the upper half of ranges.
Decision rules:
- If price is in the upper half of a tight range AND funding ≥ 0% → SHORT 1x at 55–65%.
- If long/short ratio > 1.6 with neutral funding → SHORT 1x at 55–70%.
- FLAT when price is mid-range or breaking down.
Output JSON only, no markdown.`,
    zen: `You are ZEN in RANGE-DCA mode. Max leverage 1x.
You exit (FLAT) on regime breaks, otherwise hold the staged direction.
Decision rules:
- If |mark/index spread| > 0.5% AND |OI Δ| > 5% → FLAT (regime break).
- Otherwise pick the direction matching the side closest to mid-range, 1x, 55–65%.
Output JSON only, no markdown.`,
  },
};

const SYSTEM_PROMPTS = PROMPTS_BY_MODE.momentum; // back-compat for any external import

export async function getAgentVotes(
  signals: MarketSignals,
  currentPosition = currentPositionDefault,
  mode: StrategyMode = "momentum"
): Promise<AgentVotes> {
  const prompts = PROMPTS_BY_MODE[mode] ?? PROMPTS_BY_MODE.momentum;
  const [bull, bear, zen] = await Promise.all([
    askAgent("bull", prompts.bull, signals, currentPosition, mode),
    askAgent("bear", prompts.bear, signals, currentPosition, mode),
    askAgent("zen", prompts.zen, signals, currentPosition, mode),
  ]);

  return applyRegimeGuard({ bull, bear, zen }, signals);
}

/**
 * Deterministic prior applied when all three agents return FLAT but the
 * market is structurally extreme. Documented in README under "Strategy".
 *
 * - Crowded longs (L/S > 2.0 or funding > 0.02%/hr) → flip BEAR to SHORT 1.5x.
 * - Crowded shorts (L/S < 0.6 or funding < -0.02%/hr) → flip BULL to LONG 1.5x.
 *
 * This is not a market call; it is a regime guard so the dashboard does not
 * show 57 unanimous-FLAT cycles when the market is plainly one-sided.
 */
function applyRegimeGuard(votes: AgentVotes, signals: MarketSignals): AgentVotes {
  const allFlat = [votes.bull, votes.bear, votes.zen].every(
    (v) => v.direction === "FLAT"
  );
  if (!allFlat) return votes;

  if (signals.lsRatio > 2.0 || signals.fundingRate > 0.02) {
    return {
      ...votes,
      bear: {
        direction: "SHORT",
        leverage: 1.5,
        confidence: 62,
        reasoning: truncateReasoning(
          "Regime guard: crowded longs (L/S high or funding positive) → contrarian SHORT bias."
        ),
      },
    };
  }
  if (signals.lsRatio < 0.6 || signals.fundingRate < -0.02) {
    return {
      ...votes,
      bull: {
        direction: "LONG",
        leverage: 1.5,
        confidence: 62,
        reasoning: truncateReasoning(
          "Regime guard: crowded shorts → squeeze thesis LONG bias."
        ),
      },
    };
  }
  return votes;
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
    // On-chain confidence floor is 60 (enforced in log_multi_agent_decision).
    // Off-chain executor uses the same floor so the program never rejects.
    shouldExecute: direction !== "FLAT" && confidence >= 60,
    agreeingCount,
  };
}

async function askAgent(
  name: keyof typeof PROMPTS_BY_MODE.momentum,
  system: string,
  signals: MarketSignals,
  currentPosition: string,
  mode: StrategyMode
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
          content: `Active strategy mode: ${mode}.
Market data for SOL-PERP on Drift Protocol:
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

function normalizeVote(raw: any, name: keyof typeof PROMPTS_BY_MODE.momentum): AgentVote {
  const direction =
    raw.direction === "LONG" || raw.direction === "SHORT" || raw.direction === "FLAT"
      ? raw.direction
      : "FLAT";
  // On-chain caps: BULL 3x, BEAR 2x, ZEN 2x. Mirror the program limits.
  const maxLeverage = name === "zen" ? 2 : name === "bear" ? 2 : 3;

  return {
    direction,
    leverage: Math.min(maxLeverage, Math.max(1, Number(raw.leverage) || 1)),
    confidence: Math.min(100, Math.max(0, Math.round(Number(raw.confidence) || 0))),
    reasoning: truncateReasoning(String(raw.reasoning || "No reasoning provided")),
  };
}
