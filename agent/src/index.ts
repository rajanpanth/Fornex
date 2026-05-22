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
import type { ConsensusDecision } from "./types";

const LOOP_MS = 15 * 60 * 1000;
let running = false;

async function runCycle(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const vault = await fetchVault();
    if (vault.isTradingPaused) {
      console.warn("Agent paused via vault state.");
      return;
    }

    const signals = await fetchSignals();
    const position = await getCurrentPosition();
    const positionLabel = position
      ? `${position.direction} ${position.leverage || 1}x`
      : "NONE";
    const votes = await getAgentVotes(signals, positionLabel);
    const consensus = getConsensus(votes);

    let executionSig: string | null = null;
    let paymentSig: string | null = null;

    if (consensus.shouldExecute && !position && consensus.direction !== "FLAT") {
      executionSig = await openPosition(
        consensus.direction,
        consensus.leverage,
        0.1
      );
      await logDecisionOnChain(votes, consensus, Boolean(executionSig), executionSig);
      if (executionSig) paymentSig = await payAgentForTrade();
    } else if (consensus.direction === "FLAT" && position) {
      const close = await closePosition();
      executionSig = close?.txSig || null;
      await logDecisionOnChain(votes, consensus, Boolean(executionSig), executionSig);
    } else {
      await logDecisionOnChain(votes, consensus, false, null);
    }

    await delay(30_000);
    const pnlSol = await getVaultPnL();
    const newNavLamports = vault.nav.toNumber() + Math.round(pnlSol * LAMPORTS_PER_SOL);
    const navSig = await updateNavOnChain(Math.max(0, newNavLamports));

    printCycle(signals, votes, consensus, executionSig, paymentSig, navSig);
  } catch (error) {
    console.warn("[agent] cycle failed", error);
  } finally {
    running = false;
  }
}

function printCycle(
  signals: Awaited<ReturnType<typeof fetchSignals>>,
  votes: Awaited<ReturnType<typeof getAgentVotes>>,
  consensus: ConsensusDecision,
  executionSig: string | null,
  paymentSig: string | null,
  navSig: string | null
) {
  console.log(`[cycle] Price: $${signals.currentPrice} | Funding: ${signals.fundingRate}%`);
  console.log(`[cycle] Votes -> Bull: ${votes.bull.direction}, Bear: ${votes.bear.direction}, Zen: ${votes.zen.direction}`);
  console.log(`[cycle] Consensus: ${consensus.direction} ${consensus.leverage}x | Executed: ${!!executionSig}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", async () => {
  await shutdownExecutor();
  process.exit(0);
});

void initExecutor().finally(() => {
  void runCycle();
  setInterval(() => void runCycle(), LOOP_MS);
});
