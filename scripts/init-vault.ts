/**
 * scripts/init-vault.ts
 * One-time setup: initializes the Fornex vault on devnet.
 *
 * Usage:
 *   npx ts-node scripts/init-vault.ts [AGENT_PUBKEY]
 *
 * If AGENT_PUBKEY is omitted, the admin wallet is used as the agent authority.
 */

import { createHash } from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Config ──────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey(
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"
);
const RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// ── Helpers ─────────────────────────────────────────────────────────
function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

function loadKeypairFromFile(filePath: string): Keypair {
  const resolved = filePath.replace("~", os.homedir());
  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Fornex Protocol — Vault Initialization");
  console.log("═══════════════════════════════════════════════════\n");

  // Load admin keypair (default Solana CLI wallet)
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const admin = loadKeypairFromFile(walletPath);
  console.log("Admin wallet:", admin.publicKey.toBase58());

  // Agent authority — passed as CLI arg, or defaults to admin
  const agentPubkey = process.argv[2]
    ? new PublicKey(process.argv[2])
    : admin.publicKey;
  console.log("Agent authority:", agentPubkey.toBase58());

  // Derive vault PDA
  const [vaultPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    PROGRAM_ID
  );
  const [vaultMintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_mint"), vaultPDA.toBuffer()],
    PROGRAM_ID
  );
  console.log("Vault PDA:", vaultPDA.toBase58());
  console.log("$FNRX mint PDA:", vaultMintPDA.toBase58());
  console.log("Vault bump:", bump);

  // Check if vault already exists
  const existing = await connection.getAccountInfo(vaultPDA);
  if (existing) {
    const existingMint = await connection.getAccountInfo(vaultMintPDA);
    if (existingMint) {
      console.log("\n⚠️  Vault and $FNRX mint already initialized! Skipping.");
      console.log("Vault address:", vaultPDA.toBase58());
      console.log("$FNRX mint:", vaultMintPDA.toBase58());
      process.exit(0);
    }

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPDA, isSigner: false, isWritable: false },
        { pubkey: vaultMintPDA, isSigner: false, isWritable: true },
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: discriminator("global", "initialize_vault_mint"),
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);

    console.log("\nSending initialize_vault_mint transaction...");
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    console.log("\n✅ $FNRX mint initialized successfully!");
    console.log("Transaction:", sig);
    console.log("Vault address:", vaultPDA.toBase58());
    console.log("$FNRX mint:", vaultMintPDA.toBase58());
    process.exit(0);
  }

  // Build instruction data: discriminator + agent_authority pubkey
  const data = Buffer.concat([
    discriminator("global", "initialize_vault_with_mint"),
    agentPubkey.toBuffer(),
  ]);

  // Build instruction
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      { pubkey: vaultMintPDA, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  // Send transaction
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);

  console.log("\nSending initialize_vault transaction...");
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");

  console.log("\n✅ Vault initialized successfully!");
  console.log("Transaction:", sig);
  console.log("Vault address:", vaultPDA.toBase58());
  console.log("$FNRX mint:", vaultMintPDA.toBase58());
  console.log(
    "\nExplorer:",
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );
  console.log(
    "\n📋 Add to agent/.env:",
    `\n   VAULT_ADDRESS=${vaultPDA.toBase58()}`
  );
  console.log(
    "📋 Add to frontend/.env.local:",
    `\n   NEXT_PUBLIC_VAULT_ADDRESS=${vaultPDA.toBase58()}`
  );
}

main().catch((err) => {
  console.error("❌ Failed to initialize vault:", err);
  process.exit(1);
});
