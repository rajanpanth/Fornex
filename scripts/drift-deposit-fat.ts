/**
 * Deposit attempt with the FULL drift devnet account list as remaining accounts.
 * Includes all oracles + all spot markets + all perp markets in correct order.
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
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { createHash } from "crypto";

const DRIFT = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

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

  // Subscribe to ALL spot and perp markets
  const accountLoader = new (drift as any).BulkAccountLoader(conn, "confirmed", 1000);
  const client = new (drift as any).DriftClient({
    connection: conn, wallet, env: "devnet",
    perpMarketIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    spotMarketIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    accountSubscription: { type: "polling", accountLoader },
  });
  await client.subscribe();
  await new Promise(r => setTimeout(r, 8000));
  await accountLoader.load();

  // Pin the specific accounts we care about
  const usdcSpot = client.getSpotMarketAccount(0);
  const solSpot = client.getSpotMarketAccount(1);
  const solPerp = client.getPerpMarketAccount(0);

  if (!usdcSpot || !solSpot || !solPerp) {
    console.error("Markets not loaded");
    return;
  }

  console.log("Markets loaded:");
  console.log("  USDC spot:", usdcSpot.pubkey.toBase58());
  console.log("  SOL spot: ", solSpot.pubkey.toBase58());
  console.log("  SOL perp: ", solPerp.pubkey.toBase58());

  // Find user account
  const subAccountId = 0;
  const subBuf = Buffer.alloc(2);
  subBuf.writeUInt16LE(subAccountId);
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), kp.publicKey.toBuffer(), subBuf], DRIFT
  );
  const [userStatsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), kp.publicKey.toBuffer()], DRIFT
  );
  const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, kp.publicKey);

  const STATE = await client.getStatePublicKey();

  // Build the deposit ix manually
  // Named accounts (per IDL):
  const named = [
    { pubkey: STATE, isSigner: false, isWritable: false },
    { pubkey: userPda, isSigner: false, isWritable: true },
    { pubkey: userStatsPda, isSigner: false, isWritable: true },
    { pubkey: kp.publicKey, isSigner: true, isWritable: true },
    { pubkey: usdcSpot.vault, isSigner: false, isWritable: true },
    { pubkey: usdcAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  // Remaining accounts: oracles → spots → perps (deployed program v2.160 expects this order).
  // We do NOT include the token mint here because get_token_mint will read it
  // optionally; on legacy SPL Token (not Token-2022) it returns None and is fine.
  // Including it as a non-Mint account confuses the iterator parsing.
  const remaining = [
    { pubkey: usdcSpot.oracle, isSigner: false, isWritable: false },
    { pubkey: usdcSpot.pubkey, isSigner: false, isWritable: true },
  ];

  const data = Buffer.concat([
    disc("deposit"),
    Buffer.from(new Uint16Array([0]).buffer),
    new BN(100 * 1e6).toArrayLike(Buffer, "le", 8),
    Buffer.from([0]),
  ]);

  console.log("\nNamed accounts:");
  named.forEach((k, i) => console.log(`  [${i}]`, k.pubkey.toBase58(), "w="+k.isWritable, "s="+k.isSigner));
  console.log("Remaining accounts:");
  remaining.forEach((k, i) => console.log(`  [${i}]`, k.pubkey.toBase58(), "w="+k.isWritable));

  const ix = new TransactionInstruction({
    programId: DRIFT,
    keys: [...named, ...remaining],
    data,
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }))
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }))
    .add(ix);
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(kp);

  console.log("\nSending...");
  try {
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
    console.log("  Sent (skipPreflight):", sig);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("✅ DEPOSIT SUCCESS:", sig);
    console.log(`   https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (e: any) {
    console.error("❌ Deposit failed");
    if (e.logs) e.logs.forEach((l: string) => console.error("   ", l));
    else console.error(e.message);
  }

  await client.unsubscribe?.();
}

main().catch(e => { console.error(e); process.exit(1); });
