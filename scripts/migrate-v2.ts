/**
 * Calls migrate_vault_v2 to realloc the on-devnet vault to the v0.2 layout
 * with `executed_trade_count` and `inception_nav` fields, and backfills
 * `inception_nav` from the current NAV.
 *
 * Usage: npx ts-node scripts/migrate-v2.ts
 */
import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf");
const VAULT_ADDRESS = new PublicKey("HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR");
const RPC = "https://api.devnet.solana.com";

function discriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function loadAdmin(): Keypair {
  const cliPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const arr = JSON.parse(fs.readFileSync(cliPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const admin = loadAdmin();
  console.log("Admin:", admin.publicKey.toBase58());

  const before = await conn.getAccountInfo(VAULT_ADDRESS);
  if (!before) throw new Error("Vault account not found");
  console.log("Vault size before:", before.data.length);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: VAULT_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator("migrate_vault_v2"),
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  const sig = await conn.sendRawTransaction(tx.serialize());
  console.log("Tx sent:", sig);
  await conn.confirmTransaction(sig, "confirmed");

  const after = await conn.getAccountInfo(VAULT_ADDRESS);
  console.log("Vault size after :", after?.data.length);
  console.log("Migration tx     :", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
