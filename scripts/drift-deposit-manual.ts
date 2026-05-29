/**
 * Build and send a Drift deposit instruction MANUALLY, bypassing the SDK's
 * IDL-based ix encoder. We craft the exact account list and instruction
 * data the on-chain program expects.
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
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { createHash } from "crypto";

const DRIFT = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

async function main() {
  const conn = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
  const sk = bs58.decode(process.env.AGENT_KEYPAIR!);
  const kp = Keypair.fromSecretKey(sk);

  // Hardcoded devnet Drift addresses (verified via SDK getSpotMarketAccount)
  const STATE = new PublicKey("5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN");
  const SPOT_MARKET_0 = new PublicKey("6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3"); // USDC spot market
  const SPOT_MARKET_VAULT_USDC = new PublicKey("GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg");
  const USDC_MINT = new PublicKey("8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2");
  const USDC_ORACLE = new PublicKey("9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV");

  // User account PDA
  const subAccountId = 0;
  const subBuf = Buffer.alloc(2);
  subBuf.writeUInt16LE(subAccountId);
  const [userAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), kp.publicKey.toBuffer(), subBuf],
    DRIFT
  );
  const [userStatsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), kp.publicKey.toBuffer()],
    DRIFT
  );
  const usdcAta = await getAssociatedTokenAddress(USDC_MINT, kp.publicKey);

  console.log("User account:", userAccountPda.toBase58());
  console.log("User stats:  ", userStatsPda.toBase58());
  console.log("USDC ATA:    ", usdcAta.toBase58());

  // Instruction data: discriminator(deposit) + market_index (u16) + amount (u64) + reduce_only (bool)
  const amount = new BN(100 * 1e6); // 100 USDC
  const data = Buffer.concat([
    discriminator("deposit"),
    Buffer.from(new Uint16Array([0]).buffer), // market_index = 0
    amount.toArrayLike(Buffer, "le", 8),
    Buffer.from([0]), // reduce_only = false
  ]);

  // Named accounts (per IDL)
  const named = [
    { pubkey: STATE, isSigner: false, isWritable: false },
    { pubkey: userAccountPda, isSigner: false, isWritable: true },
    { pubkey: userStatsPda, isSigner: false, isWritable: true },
    { pubkey: kp.publicKey, isSigner: true, isWritable: true },
    { pubkey: SPOT_MARKET_VAULT_USDC, isSigner: false, isWritable: true },
    { pubkey: usdcAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  // Remaining accounts: oracles → spots → perps → mint
  const remaining = [
    { pubkey: USDC_ORACLE, isSigner: false, isWritable: false },
    { pubkey: SPOT_MARKET_0, isSigner: false, isWritable: true },
    // get_token_mint reads next; pass the USDC mint
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    programId: DRIFT,
    keys: [...named, ...remaining],
    data,
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }))
    .add(ix);
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(kp);

  console.log("Sending manual deposit...");
  try {
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(sig, "confirmed");
    console.log("✅ Deposit tx:", sig);
    console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (e: any) {
    console.error("❌ Deposit failed");
    if (e.logs) e.logs.forEach((l: string) => console.error("   ", l));
    else console.error(e.message);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
