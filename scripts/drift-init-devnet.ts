/**
 * Use the SDK's initializeUserAccountForDevnet method which is purpose-built
 * for this scenario. It mints from the faucet AND deposits in one tx, so
 * the SDK handles the remaining accounts internally.
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Drift devnet mock USDC faucet
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
  console.log("USDC mint:", usdcSpot.mint.toBase58());

  // Build a TokenFaucet pointing at the devnet mock USDC mint authority
  const faucet = new (drift as any).TokenFaucet(
    conn,
    wallet,
    MOCK_USDC_FAUCET,
    usdcSpot.mint
  );

  // initializeUserAccountForDevnet creates the user, the user-stats, mints
  // mock USDC, and deposits in a single transaction via the SDK's atomic
  // helper. This includes all the right remaining accounts.
  const usdcAmount = new BN(100 * 1e6);
  console.log("Calling initializeUserAccountForDevnet ...");
  try {
    const result: any = await client.initializeUserAccountForDevnet(
      0,
      "Fornex Agent v1",
      0,        // collateral spot market index = 0 (USDC)
      faucet,
      usdcAmount
    );
    const initTx = result?.[0];
    const userPubkey = result?.[1];
    console.log("✅ Init tx:", initTx);
    console.log("   User:    ", userPubkey?.toBase58?.());
    console.log("   Explorer:", `https://explorer.solana.com/tx/${initTx}?cluster=devnet`);
  } catch (e: any) {
    console.error("❌ Init failed");
    if (e.logs) e.logs.forEach((l: string) => console.error("   ", l));
    else console.error(e.message);
    if (e.transactionLogs) e.transactionLogs.forEach((l: string) => console.error("    [txlog]", l));
  }

  await client.unsubscribe?.();
}

main().catch(e => { console.error(e); process.exit(1); });
