/**
 * Trace the exact account list and ordering that the SDK builds for a deposit.
 * Compare against on-chain expectations.
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
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
    connection: conn,
    wallet,
    env: "devnet",
    perpMarketIndexes: [0],
    spotMarketIndexes: [0, 1],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise((r) => setTimeout(r, 5000));
  await accountLoader.load();
  await client.fetchAccounts?.();

  const usdcSpot = client.getSpotMarketAccount(0);
  const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, kp.publicKey);

  // Build the deposit instruction manually
  const depositIx = await client.getDepositInstruction(
    new BN(100 * 1e6),
    0,
    usdcAta,
    0,
    false,
    true // userInitialized
  );

  console.log("\n=== Deposit instruction account list ===");
  console.log(`Program: ${depositIx.programId.toBase58()}`);
  console.log(`# named accounts: ${depositIx.keys.length}`);
  depositIx.keys.forEach((k: any, i: number) => {
    console.log(
      `  [${i}] ${k.pubkey.toBase58()}  signer=${k.isSigner} writable=${k.isWritable}`
    );
  });

  // Print the data prefix (discriminator + args) so we can confirm it's deposit
  console.log("\nData hex (first 16 bytes):", depositIx.data.subarray(0, 16).toString("hex"));

  await client.unsubscribe?.();
}

main().catch((e) => { console.error(e); process.exit(1); });
