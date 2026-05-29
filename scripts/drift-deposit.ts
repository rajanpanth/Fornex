/**
 * Bootstrap the agent's Drift user by depositing 100 mock USDC directly.
 * Skips initialization (the user account already exists from prior runs)
 * and uses the BulkAccountLoader polling subscription so we don't hang on
 * websocket subscribe.
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "agent", ".env") });

import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
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

  console.log("Subscribing to Drift devnet (polling, may take ~10s)...");
  const subOk = await Promise.race([
    client.subscribe().then(() => true),
    new Promise((res) => setTimeout(() => res("timeout"), 30_000)),
  ]);
  console.log("Subscribe result:", subOk);

  const usdcSpot = client.getSpotMarketAccount(0);
  console.log("USDC mint:", usdcSpot?.mint?.toBase58?.());

  // Check user state
  let user: any = null;
  try {
    user = client.getUser();
    await user.fetchAccounts();
    console.log("User exists:", user.getUserAccountPublicKey().toBase58());
    const acct = user.getUserAccount();
    console.log("Sub-account name:", Buffer.from(acct.name || []).toString("utf8").trim());
  } catch (e: any) {
    console.log("User not found via getUser:", e?.message);
  }

  const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, kp.publicKey);
  const ataInfo = await conn.getAccountInfo(usdcAta);
  console.log("USDC ATA:", usdcAta.toBase58(), "exists:", !!ataInfo);

  // Direct deposit
  // Re-fetch user after init
  try {
    await client.fetchAccounts?.();
    user = client.getUser();
    await user.fetchAccounts();
    console.log("User now exists:", user.getUserAccountPublicKey().toBase58());
  } catch (e: any) {
    console.log("Re-fetch user failed:", e?.message);
  }

  // Force the SDK to load the spot market accounts into its cache. Without
  // this, `getRemainingAccounts` doesn't include market 0 → on-chain
  // SpotMarketNotFound (0x17c7).
  console.log("Warming spot market cache...");
  await new Promise((r) => setTimeout(r, 5000));
  await accountLoader.load();
  await client.fetchAccounts?.();
  console.log("Spot 0:", client.getSpotMarketAccount(0)?.pubkey?.toBase58());
  console.log("Spot 1:", client.getSpotMarketAccount(1)?.pubkey?.toBase58());

  if (user) {
    console.log("Depositing 100 USDC into Drift sub-account 0 ...");
    try {
      // Build instruction manually so we can pass writableSpotMarketIndexes
      // and pin the spot market account explicitly.
      const depositIx = await client.getDepositInstruction(
        new BN(100 * 1e6),
        0,
        usdcAta,
        0,
        false,
        true
      );
      const { Transaction } = await import("@solana/web3.js");
      const tx = new Transaction().add(depositIx);
      tx.feePayer = kp.publicKey;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      tx.sign(kp);
      const sig = await conn.sendRawTransaction(tx.serialize());
      await conn.confirmTransaction(sig, "confirmed");
      console.log("Deposit tx:", sig);
    } catch (e: any) {
      console.error("Deposit failed:", e?.message || e);
    }
  } else {
    console.log("No user account — falling back to initializeUserAccount");
    try {
      const result: any = await client.initializeUserAccount(0, "Fornex Agent v1");
      console.log("init tx:", result);
    } catch (e: any) {
      console.error("init failed:", e?.message || e);
    }
  }

  await client.unsubscribe?.();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
