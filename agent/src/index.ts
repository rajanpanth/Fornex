import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAgentVotes, getConsensus } from "./brain";
import {
  closePosition,
  getCurrentPosition,
  getVaultPnL,
  initExecutor,
  openPosition,
  shutdownExecutor,
} from "./executor";
import { fetchVault, logDecisionOnChain, updateNavOnChain } from "./logger";
import { payAgentForTrade } from "./paysh";
import { fetchSignals } from "./signals";
import type { AgentVotes, ConsensusDecision, CurrentPosition, MarketSignals } from "./types";

const LOOP_MS = 900_000;
const SINGLE_CYCLE =
  process.argv.includes("--once") || process.env.FORNEX_SINGLE_CYCLE === "1";
const BOX_WIDTH = 55;
const BORDER = "═".repeat(BOX_WIDTH);
let running = false;
let cycleNumber = 0;

async function runCycle(): Promise<void> {
  if (running) return;
  running = true;
  cycleNumber += 1;
  const cycleStartedAt = new Date();

  try {
    const vault = await safeStep("fetch vault", fetchVault);
    if (!vault) return;

    if (vault.isTradingPaused) {
      printPausedCycle(cycleStartedAt, cycleNumber);
      return;
    }

    const signals = await safeStep("fetch signals", fetchSignals, 60_000);
    if (!signals) return;

    const position = await safeStep("read current position", getCurrentPosition, 45_000);
    const positionLabel = position
      ? `${position.direction} ${position.leverage || 1}x`
      : "NONE";

    const votes =
      (await safeStep(
        "collect agent votes",
        () => getAgentVotes(signals, positionLabel),
        75_000
      )) ?? fallbackVotes("AI vote timeout; defaulting flat");

    const consensus = getConsensus(votes);

    let executionSig: string | null = null;
    let paymentSig: string | null = null;
    let logSig: string | null = null;
    const tradeDirection = consensus.direction;

    if (consensus.shouldExecute && !position && tradeDirection !== "FLAT") {
      executionSig = await safeStep("execute Drift order", () =>
        openPosition(tradeDirection, consensus.leverage, 0.1)
      , 60_000);
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensus, Boolean(executionSig), executionSig)
      , 60_000);
      if (executionSig) {
        paymentSig = await safeStep("track pay.sh payment", payAgentForTrade, 45_000);
      }
    } else if (consensus.direction === "FLAT" && position) {
      const close = await safeStep("close Drift position", closePosition, 60_000);
      executionSig = close?.txSig || null;
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensus, Boolean(executionSig), executionSig)
      , 60_000);
    } else {
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensus, false, null)
      , 60_000);
    }

    const pnlSol = (await safeStep("read vault PnL", getVaultPnL, 45_000)) ?? 0;
    const oldNavLamports = vault.nav.toNumber();
    const newNavLamports = oldNavLamports + Math.round(pnlSol * LAMPORTS_PER_SOL);
    const safeNavLamports = Math.max(0, newNavLamports);
    const navSig = await safeStep("update NAV on-chain", () =>
      updateNavOnChain(safeNavLamports)
    , 60_000);

    printCycle({
      signals,
      votes,
      consensus,
      executionSig,
      paymentSig,
      logSig,
      navSig,
      cycleStartedAt,
      cycleNumber,
      oldNavLamports,
      newNavLamports: safeNavLamports,
      position,
    });
  } catch (error) {
    console.warn("[agent] cycle failed", error);
  } finally {
    running = false;
  }
}

async function safeStep<T>(
  label: string,
  step: () => Promise<T>,
  timeoutMs = 45_000
): Promise<T | null> {
  try {
    return await withTimeout(step(), timeoutMs, `${label} timed out`);
  } catch (error) {
    console.warn(`[agent] ${label} failed`, error);
    return null;
  }
}

function fallbackVotes(reasoning: string): AgentVotes {
  const vote = {
    direction: "FLAT" as const,
    leverage: 1,
    confidence: 50,
    reasoning,
  };
  return { bull: vote, bear: vote, zen: vote };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function printCycle({
  signals,
  votes,
  consensus,
  executionSig,
  paymentSig,
  logSig,
  navSig,
  cycleStartedAt,
  cycleNumber,
  oldNavLamports,
  newNavLamports,
}: {
  signals: MarketSignals;
  votes: AgentVotes;
  consensus: ConsensusDecision;
  executionSig: string | null;
  paymentSig: string | null;
  logSig: string | null;
  navSig: string | null;
  cycleStartedAt: Date;
  cycleNumber: number;
  oldNavLamports: number;
  newNavLamports: number;
  position: CurrentPosition | null;
}) {
  const navSol = newNavLamports / LAMPORTS_PER_SOL;
  const navChange =
    oldNavLamports > 0
      ? ((newNavLamports - oldNavLamports) / oldNavLamports) * 100
      : 0;

  console.log(`\n╔${BORDER}╗`);
  console.log(line("     FORNEX AUTONOMOUS AGENT v1.0"));
  console.log(line("     Solana Devnet | Drift Protocol"));
  console.log(`╠${BORDER}╣`);
  console.log(line(` 🕐  ${time(cycleStartedAt)}  |  Cycle #${cycleNumber}`));
  console.log(
    line(
      ` 📊  SOL: $${signals.currentPrice.toFixed(2)}  |  Funding: ${signals.fundingRate.toFixed(4)}%/hr`
    )
  );
  console.log(`╠${BORDER}╣`);
  console.log(voteLine("🐂", "BULL", votes.bull));
  console.log(reasonLine(votes.bull.reasoning));
  console.log(voteLine("🐻", "BEAR", votes.bear));
  console.log(reasonLine(votes.bear.reasoning));
  console.log(voteLine("⚖️", "ZEN", votes.zen));
  console.log(reasonLine(votes.zen.reasoning));
  console.log(`╠${BORDER}╣`);
  console.log(
    line(
      ` ✅  CONSENSUS: ${consensus.direction} ${consensus.leverage}x | conf: ${consensus.confidence}%`
    )
  );
  console.log(line(executionSig ? " 🔄  Drift execution confirmed" : " 🔄  No Drift execution this cycle"));
  console.log(line(` 📝  Logged: ${shortSig(logSig)}`));
  console.log(line(` 💸  pay.sh: ${paymentSig ? "0.001 SOL earned" : "no payment this cycle"}`));
  console.log(
    line(` 📈  Vault NAV: ${navSol.toFixed(2)} SOL (${signed(navChange)}%)`)
  );
  if (navSig) console.log(line(` 🧾  NAV tx: ${shortSig(navSig)}`));
  console.log(`╚${BORDER}╝\n`);
}

function printPausedCycle(cycleStartedAt: Date, cycleNumber: number) {
  console.log(`\n╔${BORDER}╗`);
  console.log(line("     FORNEX AUTONOMOUS AGENT v1.0"));
  console.log(line(` 🕐  ${time(cycleStartedAt)}  |  Cycle #${cycleNumber}`));
  console.log(line(" ⏸️   Trading paused on-chain. Cycle skipped."));
  console.log(`╚${BORDER}╝\n`);
}

function voteLine(emoji: string, name: string, vote: AgentVotes["bull"]) {
  return line(
    ` ${emoji} ${name.padEnd(5)} →  ${vote.direction.padEnd(5)} ${vote.leverage}x  ${vote.confidence}%`
  );
}

function reasonLine(reasoning: string) {
  return line(`     "${clip(reasoning, BOX_WIDTH - 13)}"`);
}

function line(text: string) {
  const clean = clip(text, BOX_WIDTH - 2);
  return `║${clean.padEnd(BOX_WIDTH)}║`;
}

function time(value: Date) {
  return value.toTimeString().slice(0, 8);
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function shortSig(value: string | null) {
  if (!value) return "not logged";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 3))}...` : value;
}

process.on("SIGINT", async () => {
  await shutdownExecutor();
  process.exit(0);
});

void initExecutor().finally(() => {
  void runCycle().finally(async () => {
    if (SINGLE_CYCLE) {
      await shutdownExecutor();
      process.exit(0);
    }
  });
  if (!SINGLE_CYCLE) setInterval(() => void runCycle(), LOOP_MS);
});
