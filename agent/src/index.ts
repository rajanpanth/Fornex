import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAgentVotes, getConsensus } from "./brain";
import {
  closePosition,
  executorName,
  getCurrentPosition,
  initExecutor,
  openPosition,
  shutdownExecutor,
} from "./executors";
import {
  fetchVault,
  logDecisionOnChain,
  recordTradeOutcomeOnChain,
  syncVaultNav,
  updateAgentReputationOnChain,
  updateNavOnChain,
} from "./logger";
import { payAgentForTrade } from "./paysh";
import { fetchSignals } from "./signals";
import { fetchStrategyMode } from "./strategyMode";
import type {
  AgentVotes,
  ConsensusDecision,
  CurrentPosition,
  Direction,
  MarketSignals,
} from "./types";

const LOOP_MS = 900_000;
const SINGLE_CYCLE =
  process.argv.includes("--once") || process.env.FORNEX_SINGLE_CYCLE === "1";
const ALLOCATION_PCT = 0.05;
const MIN_COLLATERAL_SOL = 0.05;
const MAX_COLLATERAL_SOL = 1.0;
const MIN_NAV_LAMPORTS = 1_000_000;
const BOX_WIDTH = 55;
const BORDER = "═".repeat(BOX_WIDTH);

// Optional manual override for the demo. Set FORNEX_FORCE_DIRECTION=LONG or
// =SHORT in the agent env to force the next cycle to execute that direction
// regardless of consensus. Documented in DEMO_SCRIPT.md.
const FORCED_DIRECTION = (process.env.FORNEX_FORCE_DIRECTION as Direction | undefined) || undefined;

// FORNEX_FORCE_CLOSE=1 closes any open position regardless of consensus.
// Used during demo-baking to settle synthetic positions and surface real
// realized-PnL deltas in the on-chain win-rate counters.
const FORCE_CLOSE = process.env.FORNEX_FORCE_CLOSE === "1";

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

    const strategyMode =
      (await safeStep("fetch strategy mode", fetchStrategyMode, 30_000)) ?? "momentum";

    const votes =
      (await safeStep(
        "collect agent votes",
        () => getAgentVotes(signals, positionLabel, strategyMode),
        75_000
      )) ?? fallbackVotes("AI vote timeout; defaulting flat");

    const consensus = getConsensus(votes);

    let executionSig: string | null = null;
    let paymentSig: string | null = null;
    let logSig: string | null = null;
    let realizedPnLLamports = 0;

    const tradeDirection: Direction = FORCED_DIRECTION ?? consensus.direction;
    // Synthetic executor is always live. Drift executor honors DRIFT_SKIP_EXECUTION.
    const driftBlocked =
      executorName === "drift" && process.env.DRIFT_SKIP_EXECUTION !== "0";
    const shouldExecute = FORCED_DIRECTION
      ? tradeDirection !== "FLAT" && !driftBlocked
      : consensus.shouldExecute && !driftBlocked;

    if (FORCED_DIRECTION && driftBlocked) {
      console.log(
        `[agent] FORNEX_FORCE_DIRECTION=${FORCED_DIRECTION} ignored: ` +
          "Drift executor is gated by DRIFT_SKIP_EXECUTION."
      );
    } else if (FORCED_DIRECTION) {
      console.log(`[agent] FORNEX_FORCE_DIRECTION=${FORCED_DIRECTION} — overriding consensus`);
    }
    console.log(`[agent] executor: ${executorName}`);

    if (shouldExecute && !position && tradeDirection !== "FLAT") {
      executionSig = await safeStep("open position", () =>
        openPosition(tradeDirection as Exclude<Direction, "FLAT">, consensus.leverage, collateral)
      , 60_000);
      // Use the consensus object for logging so the on-chain decision matches
      // what would have executed without the override. Override is purely for
      // manual demo execution; the AI vote breakdown remains honest.
      const consensusForLog: ConsensusDecision = FORCED_DIRECTION
        ? { ...consensus, direction: FORCED_DIRECTION, confidence: Math.max(consensus.confidence, 60), shouldExecute: true }
        : consensus;
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensusForLog, Boolean(executionSig), executionSig)
      , 60_000);
      if (executionSig) {
        paymentSig = await safeStep("track pay.sh payment", payAgentForTrade, 45_000);
      }
    } else if ((consensus.direction === "FLAT" || FORCE_CLOSE) && position) {
      const close = await safeStep("close position", closePosition, 60_000);
      executionSig = close?.txSig || null;
      realizedPnLLamports = Math.round((close?.realizedPnl ?? 0) * LAMPORTS_PER_SOL);
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensus, Boolean(executionSig), executionSig)
      , 60_000);
      // For Drift adapter, record_trade_outcome is called separately. For the
      // Synthetic adapter, close_synthetic_position already bumps the vault
      // counters atomically, so we skip the second on-chain call.
      if (executionSig && executorName !== "synthetic") {
        await safeStep("record trade outcome", () =>
          recordTradeOutcomeOnChain(realizedPnLLamports)
        , 45_000);
      }
      // Per-agent reputation update is a separate, idempotent CPI-free
      // call that's safe to make on every close regardless of executor.
      // The PDA may not exist on older deployments — the helper handles
      // that with a logged no-op.
      if (executionSig) {
        await safeStep("update agent reputation", () =>
          updateAgentReputationOnChain(votes, realizedPnLLamports)
        , 45_000);
        paymentSig = await safeStep("track pay.sh payment", payAgentForTrade, 45_000);
      }
    } else {
      logSig = await safeStep("log decision on-chain", () =>
        logDecisionOnChain(votes, consensus, false, null)
      , 60_000);
    }

    // NAV writes are now event-driven: only push a new NAV when a trade closed
    // with non-zero realized PnL. This prevents writing identical NAVs every
    // 15 minutes and keeps the on-chain history meaningful.
    let navSig: string | null = null;
    const oldNavLamports = currentVault.nav.toNumber();
    let newNavLamports = oldNavLamports;
    if (realizedPnLLamports !== 0) {
      newNavLamports = Math.max(oldNavLamports + realizedPnLLamports, MIN_NAV_LAMPORTS);
      // Clamp to ±10% to match the on-chain cap so the call doesn't revert.
      const ceil = Math.floor(oldNavLamports * 1.10);
      const floor = Math.ceil(oldNavLamports * 0.75);
      if (oldNavLamports > 0) {
        newNavLamports = Math.min(Math.max(newNavLamports, floor), ceil);
      }
      navSig = await safeStep("update NAV on-chain", () =>
        updateNavOnChain(newNavLamports)
      , 60_000);
    }

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
      realizedPnLLamports,
      strategyMode,
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
  realizedPnLLamports,
  strategyMode,
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
  realizedPnLLamports: number;
  strategyMode: string;
}) {
  const navSol = newNavLamports / LAMPORTS_PER_SOL;
  const txSig = executionSig || logSig;

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║    FORNEX AUTONOMOUS AGENT v1.0              ║");
  console.log("║    Solana Devnet  |  Drift Protocol          ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(
    `║  🕐 ${time(cycleStartedAt)}  |  Cycle #${cycleNumber
      .toString()
      .padStart(4, "0")}                  ║`
  );
  console.log("╚══════════════════════════════════════════════╝");

  console.log("┌─ MARKET SIGNALS ──────────────────────────────");
  console.log(`│  🎛️  Mode:    ${strategyMode}`);
  console.log(`│  💰 SOL:      $${signals.currentPrice.toFixed(2)}`);
  console.log(`│  📊 Funding:  ${signals.fundingRate.toFixed(4)}%/hr`);
  console.log(`│  📈 OI Δ:     ${signed(signals.oiChange)}%`);
  console.log(`│  ⚖️  L/S:      ${signals.lsRatio.toFixed(3)}`);
  console.log(`│  🎯 Liq Wall: $${signals.liqWallPrice.toFixed(2)}`);
  console.log("└───────────────────────────────────────────────");

  console.log("┌─ AGENT VOTES ─────────────────────────────────");
  console.log(
    `│  🐂 BULL → ${votes.bull.direction.padEnd(5)} ${votes.bull.leverage}x  (${votes.bull.confidence}%)`
  );
  console.log(`│     "${clip(votes.bull.reasoning, 42)}"`);
  console.log(
    `│  🐻 BEAR → ${votes.bear.direction.padEnd(5)} ${votes.bear.leverage}x  (${votes.bear.confidence}%)`
  );
  console.log(`│     "${clip(votes.bear.reasoning, 42)}"`);
  console.log(
    `│  ⚖️  ZEN  → ${votes.zen.direction.padEnd(5)} ${votes.zen.leverage}x  (${votes.zen.confidence}%)`
  );
  console.log(`│     "${clip(votes.zen.reasoning, 42)}"`);
  console.log("└───────────────────────────────────────────────");

  const executed = consensus.shouldExecute && txSig;
  console.log("┌─ RESULT ──────────────────────────────────────");
  console.log(
    `│  ${executed ? "✅" : "⏭️ "} CONSENSUS: ${consensus.direction} ${consensus.leverage}x | conf: ${consensus.confidence}%`
  );
  console.log(
    `│  💼 Collateral: ${collateral.toFixed(4)} SOL (5% of ${vaultNavSOL.toFixed(4)} SOL)`
  );
  if (txSig) {
    console.log(`│  📝 TX: ${shortSig(txSig)}`);
  }
  if (realizedPnLLamports !== 0) {
    console.log(
      `│  💹 Realized PnL: ${(realizedPnLLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`
    );
  }
  console.log(
    `│  💸 pay.sh: ${paymentSig ? `streamed | tx: ${shortSig(paymentSig)}` : "no payment this cycle"}`
  );
  console.log(`│  📈 Vault NAV: ${navSol.toFixed(4)} SOL`);
  console.log("└───────────────────────────────────────────────");

  if (navSig) console.log(`[agent] NAV tx: ${shortSig(navSig)}`);
  if (navRecordSig) console.log(`[agent] NAV record: ${shortSig(navRecordSig)}`);
}

function printPausedCycle(cycleStartedAt: Date, cycleNumber: number) {
  console.log(`\n╔${BORDER}╗`);
  console.log(line("     FORNEX AUTONOMOUS AGENT v1.0"));
  console.log(line(` 🕐  ${time(cycleStartedAt)}  |  Cycle #${cycleNumber}`));
  console.log(line(" ⏸️   Trading paused on-chain. Cycle skipped."));
  console.log(`╚${BORDER}╝\n`);
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
