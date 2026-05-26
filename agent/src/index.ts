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
import {
  fetchVault,
  logDecisionOnChain,
  syncVaultNav,
  updateNavOnChain,
} from "./logger";
import { payAgentForTrade } from "./paysh";
import { fetchSignals } from "./signals";
import type { AgentVotes, ConsensusDecision, CurrentPosition, MarketSignals } from "./types";

const LOOP_MS = 900_000;
const SINGLE_CYCLE =
  process.argv.includes("--once") || process.env.FORNEX_SINGLE_CYCLE === "1";
const ALLOCATION_PCT = 0.05;
const MIN_COLLATERAL_SOL = 0.05;
const MAX_COLLATERAL_SOL = 1.0;
const MIN_NAV_LAMPORTS = 1_000_000;
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
    await safeStep("sync vault NAV", syncVaultNav, 60_000);

    const vault = await safeStep("fetch vault", fetchVault);
    if (!vault) return;

    if (vault.isTradingPaused) {
      printPausedCycle(cycleStartedAt, cycleNumber);
      return;
    }

    const signals = await safeStep("fetch signals", fetchSignals, 60_000);
    if (!signals) return;

    const currentVault = (await safeStep("fetch vault NAV", fetchVault)) ?? vault;
    const vaultNavSOL = currentVault.nav.toNumber() / LAMPORTS_PER_SOL;
    const collateral = calculateCollateral(vaultNavSOL);

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
        openPosition(tradeDirection, consensus.leverage, collateral)
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

    const realizedPnLSOL = (await safeStep("read vault PnL", getVaultPnL, 45_000)) ?? 0;
    const realizedPnLLamports = Math.round(realizedPnLSOL * LAMPORTS_PER_SOL);
    const oldNavLamports = currentVault.nav.toNumber();
    const newNavLamports = Math.max(
      oldNavLamports + realizedPnLLamports,
      MIN_NAV_LAMPORTS
    );
    const navSig = await safeStep("update NAV on-chain", () =>
      updateNavOnChain(newNavLamports)
    , 60_000);

    printCycle({
      signals,
      votes,
      consensus,
      executionSig,
      paymentSig,
      logSig,
      navSig,
      navRecordSig: null,
      cycleStartedAt,
      cycleNumber,
      oldNavLamports,
      newNavLamports,
      vaultNavSOL,
      collateral,
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

function calculateCollateral(vaultNavSOL: number): number {
  return Math.min(
    Math.max(vaultNavSOL * ALLOCATION_PCT, MIN_COLLATERAL_SOL),
    MAX_COLLATERAL_SOL
  );
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
  navRecordSig,
  cycleStartedAt,
  cycleNumber,
  oldNavLamports,
  newNavLamports,
  vaultNavSOL,
  collateral,
}: {
  signals: MarketSignals;
  votes: AgentVotes;
  consensus: ConsensusDecision;
  executionSig: string | null;
  paymentSig: string | null;
  logSig: string | null;
  navSig: string | null;
  navRecordSig: string | null;
  cycleStartedAt: Date;
  cycleNumber: number;
  oldNavLamports: number;
  newNavLamports: number;
  vaultNavSOL: number;
  collateral: number;
  position: CurrentPosition | null;
}) {
  const navSol = newNavLamports / LAMPORTS_PER_SOL;

  printCycleHeader(cycleNumber, time(cycleStartedAt));
  printSignals(signals);
  printCollateral(vaultNavSOL, collateral);
  printVotes(votes);
  printResult(consensus, executionSig || logSig, navSol);
  if (navSig) console.log(`[agent] NAV tx: ${shortSig(navSig)}`);
  if (navRecordSig) console.log(`[agent] NAV record: ${shortSig(navRecordSig)}`);
}

function printCycleHeader(cycleNumber: number, timeLabel: string) {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║     FORNEX AUTONOMOUS AGENT v1.0          ║");
  console.log("║     Solana Devnet  |  Drift Protocol      ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  🕐  ${timeLabel}  |  Cycle #${cycleNumber.toString().padStart(4, "0")}       ║`);
  console.log("╚════════════════════════════════════════════╝");
}

function printSignals(signals: MarketSignals) {
  console.log("┌─── MARKET SIGNALS ─────────────────────────┐");
  console.log(`│  💰 SOL Price:    $${signals.currentPrice.toFixed(4).padStart(10)}`);
  console.log(`│  📊 Funding:      ${signals.fundingRate.toFixed(4)}%/hr`);
  console.log(`│  📈 OI Change:    ${signals.oiChange.toFixed(2)}%`);
  console.log(`│  ⚖️  L/S Ratio:    ${signals.lsRatio.toFixed(3)}`);
  console.log(`│  🎯 Liq Wall:     $${signals.liqWallPrice.toFixed(2)}`);
  console.log("└────────────────────────────────────────────┘");
}

function printCollateral(vaultNavSOL: number, collateral: number) {
  console.log(
    `│  💼 Collateral: ${collateral.toFixed(4)} SOL (5% of ${vaultNavSOL.toFixed(4)} SOL vault)`
  );
}

function printVotes(votes: AgentVotes) {
  console.log("┌─── AGENT VOTES ─────────────────────────────┐");
  console.log(`│  🐂 BULL → ${votes.bull.direction.padEnd(6)} ${votes.bull.leverage}x  (${votes.bull.confidence}%)`);
  console.log(`│     "${votes.bull.reasoning.slice(0, 40)}"`);
  console.log(`│  🐻 BEAR → ${votes.bear.direction.padEnd(6)} ${votes.bear.leverage}x  (${votes.bear.confidence}%)`);
  console.log(`│     "${votes.bear.reasoning.slice(0, 40)}"`);
  console.log(`│  ⚖️  ZEN  → ${votes.zen.direction.padEnd(6)} ${votes.zen.leverage}x  (${votes.zen.confidence}%)`);
  console.log(`│     "${votes.zen.reasoning.slice(0, 40)}"`);
  console.log("└─────────────────────────────────────────────┘");
}

function printResult(
  consensus: ConsensusDecision,
  txSig: string | null,
  navSOL: number
) {
  const executed = consensus.shouldExecute && txSig;
  console.log("┌─── RESULT ──────────────────────────────────┐");
  console.log(`│  ${executed ? "✅" : "⏭️ "} CONSENSUS: ${consensus.direction} ${consensus.leverage}x | ${consensus.confidence}% conf`);
  if (txSig) {
    console.log(`│  📝 On-chain: ${txSig.slice(0, 20)}...`);
  }
  console.log("│  💸 pay.sh:   +0.001 SOL earned");
  console.log(`│  📈 Vault NAV: ${navSOL.toFixed(4)} SOL`);
  console.log("└─────────────────────────────────────────────┘\n");
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

void initExecutor().finally(async () => {
  await syncVaultNav();
  void runCycle().finally(async () => {
    if (SINGLE_CYCLE) {
      await shutdownExecutor();
      process.exit(0);
    }
  });
  if (!SINGLE_CYCLE) setInterval(() => void runCycle(), LOOP_MS);
});
