import {
  LAMPORTS_PER_TRADE_PAYMENT,
  SOL_PER_TRADE_PAYMENT,
  connection,
  loadAgentKeypair,
} from "./config";

let totalEarnedToday = 0;
let lastPaymentTimestamp: number | null = null;

export async function payAgentForTrade(): Promise<string | null> {
  try {
    const paySh = await tryPaySh();
    if (paySh) return paySh;

    console.warn(
      "[paysh] pay.sh SDK unavailable. Direct vault PDA transfer requires an on-chain payment instruction, so payment is recorded off-chain for now."
    );
    totalEarnedToday += SOL_PER_TRADE_PAYMENT;
    lastPaymentTimestamp = Date.now();
    return null;
  } catch (error) {
    console.warn("[paysh] payment failed", error);
    return null;
  }
}

export function getStreamingStats() {
  return {
    streamsPerDay: 96,
    totalEarnedToday,
    lastPaymentTimestamp,
    lamportsPerTrade: LAMPORTS_PER_TRADE_PAYMENT,
  };
}

async function tryPaySh(): Promise<string | null> {
  try {
    // @ts-ignore
    const sdk = await import("pay.sh");
    const agent = loadAgentKeypair();
    const client = new (sdk as any).PayShClient({ connection, payer: agent });
    const sig = await client.streamSol?.({
      to: agent.publicKey,
      lamports: LAMPORTS_PER_TRADE_PAYMENT,
    });
    if (sig) {
      totalEarnedToday += SOL_PER_TRADE_PAYMENT;
      lastPaymentTimestamp = Date.now();
      console.log(`[paysh] streamed ${SOL_PER_TRADE_PAYMENT} SOL: ${sig}`);
    }
    return sig || null;
  } catch {
    return null;
  }
}

