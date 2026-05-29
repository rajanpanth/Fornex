/**
 * Mint mock USDC into existing ATA, then deposit into Drift via SDK helpers.
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { BN } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import bs58 from "bs58";

const MOCK_USDC_FAUCET = new PublicKey("V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB");

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
    signAllTransactions: async (txs: any[]) => {
      for (const tx of txs) {
        if (typeof tx.partialSign === "function") tx.partialSign(kp);
        else if (typeof tx.sign === "function") tx.sign([kp]);
      }
      return txs;
    },
  };

  const accountLoader = new (drift as any).BulkAccountLoader(conn, "confirmed", 1000);
  const client = new (drift as any).DriftClient({
    connection: conn, wallet, env: "devnet",
    perpMarketIndexes: [0],
    spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise(r => setTimeout(r, 5000));
  await accountLoader.load();

  const usdcSpot = client.getSpotMarketAccount(0);
  const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, kp.publicKey);

  // Step 1: mint mock USDC to existing ATA via faucet's mintToUser
  const faucet = new (drift as any).TokenFaucet(
    conn, wallet, MOCK_USDC_FAUCET, usdcSpot.mint
  );

  const usdcAmount = new BN(100 * 1e6);
  console.log("Step 1: minting 100 USDC to ATA via faucet...");
  try {
    const sig = await faucet.mintToUser(usdcAta, usdcAmount);
    console.log("  ✅ Mint tx:", sig);
  } catch (e: any) {
    console.error("  ❌ Mint failed:", e?.message);
    if (e.logs) e.logs.forEach((l: string) => console.error("    ", l));
  }

  // Verify balance
  const ataInfo = await getAccount(conn, usdcAta);
  console.log("USDC balance now:", Number(ataInfo.amount) / 1e6);

  // Step 2: deposit into Drift via SDK
  console.log("\nStep 2: depositing into Drift...");
  try {
    const sig = await client.deposit(usdcAmount, 0, usdcAta);
    console.log("  ✅ Deposit tx:", sig);
    console.log(`     https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (e: any) {
    console.error("  ❌ Deposit failed:", e?.message);
    if (e.logs) e.logs.forEach((l: string) => console.error("    ", l));
  }

  await client.unsubscribe?.();
}

main().catch(e => { console.error(e); process.exit(1); });
