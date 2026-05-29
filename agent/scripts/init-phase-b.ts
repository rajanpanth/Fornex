/* eslint-disable no-console */

/**
 * One-shot Phase B activator.
 *
 * Initializes the two new PDAs introduced in v0.4 of the Fornex program:
 *
 *   1. AgentReputation @ ["agent_reputation", VAULT]
 *      → tracks per-persona win rate (BULL / BEAR / ZEN) on closed trades.
 *
 *   2. VaultStrategy @ ["vault_strategy", VAULT]
 *      → vault-level strategy mode that the brain reads at the top of
 *        every cycle (Momentum / MeanRevert / RangeDCA).
 *
 * Both instructions are admin-gated on-chain. Run this script once per
 * deployment, signed by the vault admin keypair.
 *
 * Usage:
 *
 *   # default: init reputation + strategy mode 0 (Momentum)
 *   npx ts-node agent/scripts/init-phase-b.ts
 *
 *   # init only the strategy PDA, mode 1 (MeanRevert)
 *   npx ts-node agent/scripts/init-phase-b.ts --strategy-only --mode 1
 *
 *   # init only the reputation PDA
 *   npx ts-node agent/scripts/init-phase-b.ts --reputation-only
 *
 * Required env (in agent/.env):
 *   - VAULT_PROGRAM_ID
 *   - VAULT_ADDRESS
 *   - FORNEX_ADMIN_KEYPAIR  (bs58 secret key of the vault admin)
 *   - SOLANA_RPC_URL        (devnet or mainnet endpoint)
 */

import { createHash } from "crypto";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PROGRAM_ID = new PublicKey(
  process.env.VAULT_PROGRAM_ID ||
    "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"
);

const VAULT_ADDRESS = new PublicKey(
  required("VAULT_ADDRESS", process.env.VAULT_ADDRESS)
);

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function required(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function loadAdmin(): Keypair {
  const encoded = required("FORNEX_ADMIN_KEYPAIR", process.env.FORNEX_ADMIN_KEYPAIR);
  return Keypair.fromSecretKey(bs58.decode(encoded));
}

function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

function readonly(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: false };
}
function writable(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: true };
}
function signer(pubkey: PublicKey) {
  return { pubkey, isSigner: true, isWritable: true };
}

async function sendTx(
  connection: Connection,
  admin: Keypair,
  ix: TransactionInstruction,
  label: string
): Promise<string> {
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ix
  );
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`[init] ${label}: ${sig}`);
  return sig;
}

async function maybeInitReputation(
  connection: Connection,
  admin: Keypair
): Promise<"created" | "skipped"> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_reputation"), VAULT_ADDRESS.toBuffer()],
    PROGRAM_ID
  );
  console.log(`[reputation] PDA: ${pda.toBase58()}`);

  const existing = await connection.getAccountInfo(pda);
  if (existing) {
    console.log("[reputation] PDA already initialized — skipping.");
    return "skipped";
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      readonly(VAULT_ADDRESS),
      writable(pda),
      signer(admin.publicKey),
      readonly(SystemProgram.programId),
    ],
    data: discriminator("global", "init_agent_reputation"),
  });

  await sendTx(connection, admin, ix, "init_agent_reputation");
  return "created";
}

async function maybeInitStrategy(
  connection: Connection,
  admin: Keypair,
  mode: number
): Promise<"created" | "skipped"> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_strategy"), VAULT_ADDRESS.toBuffer()],
    PROGRAM_ID
  );
  console.log(`[strategy] PDA: ${pda.toBase58()} (mode ${mode})`);

  const existing = await connection.getAccountInfo(pda);
  if (existing) {
    console.log(
      "[strategy] PDA already initialized — use `set_strategy_mode` to change."
    );
    return "skipped";
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      readonly(VAULT_ADDRESS),
      writable(pda),
      signer(admin.publicKey),
      readonly(SystemProgram.programId),
    ],
    data: Buffer.concat([
      discriminator("global", "init_vault_strategy"),
      Buffer.from([mode]),
    ]),
  });

  await sendTx(connection, admin, ix, "init_vault_strategy");
  return "created";
}

function parseFlags(): {
  reputationOnly: boolean;
  strategyOnly: boolean;
  mode: number;
} {
  const args = process.argv.slice(2);
  const reputationOnly = args.includes("--reputation-only");
  const strategyOnly = args.includes("--strategy-only");
  const modeIdx = args.indexOf("--mode");
  const mode = modeIdx >= 0 ? Number(args[modeIdx + 1]) : 0;
  if (!Number.isFinite(mode) || mode < 0 || mode > 2) {
    console.error(
      "Invalid --mode value. Allowed: 0 (Momentum), 1 (MeanRevert), 2 (RangeDCA)."
    );
    process.exit(1);
  }
  return { reputationOnly, strategyOnly, mode };
}

async function main(): Promise<void> {
  const { reputationOnly, strategyOnly, mode } = parseFlags();

  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const admin = loadAdmin();

  console.log(`[init] program: ${PROGRAM_ID.toBase58()}`);
  console.log(`[init] vault:   ${VAULT_ADDRESS.toBase58()}`);
  console.log(`[init] admin:   ${admin.publicKey.toBase58()}`);

  if (!strategyOnly) {
    await maybeInitReputation(connection, admin);
  }
  if (!reputationOnly) {
    await maybeInitStrategy(connection, admin, mode);
  }

  console.log("[init] Phase B activation complete.");
}

main().catch((err) => {
  console.error("[init] failed:", err);
  process.exit(1);
});
