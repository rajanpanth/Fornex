/**
 * Try placing a perp order directly. If we get InsufficientCollateral,
 * that's progress (PerpMarketNotFound is what we're stuck on now).
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

async function main() {
  const drift = await import("@drift-labs/sdk");
  const conn = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
  const sk = bs58.decode(process.env.AGENT_KEYPAIR!);
  const kp = Keypair.fromSecretKey(sk);

  const wallet = {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => {
      if (typeof tx.partialSign === "function") tx.partialSign(kp);
      else if (typeof tx.sign === "function") tx.sign([kp]);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => txs,
  };

  const accountLoader = new (drift as any).BulkAccountLoader(conn, "confirmed", 1000);
  const client = new (drift as any).DriftClient({
    connection: conn, wallet, env: "devnet",
    perpMarketIndexes: [0], spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise(r => setTimeout(r, 5000));
  await accountLoader.load();

  // Force include
  client.mustIncludePerpMarketIndexes.add(0);
  client.mustIncludeSpotMarketIndexes.add(0);
  client.mustIncludeSpotMarketIndexes.add(1);

  const orderParams = (drift as any).getMarketOrderParams({
    marketIndex: 0,
    direction: (drift as any).PositionDirection.LONG,
    baseAssetAmount: new BN(0.01 * 1e9), // 0.01 SOL
  });

  console.log("Placing perp order LONG 0.01 SOL...");
  try {
    const sig = await client.placePerpOrder(orderParams);
    console.log("✅ Perp order tx:", sig);
    console.log(`   https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (e: any) {
    console.error("❌ Order failed");
    if (e.logs) e.logs.slice(-15).forEach((l: string) => console.error("   ", l));
    else console.error(e?.message || e);
  }

  await client.unsubscribe?.();
}

main().catch(e => { console.error(e); process.exit(1); });
