import { createHash } from "crypto";
import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection, loadAgentKeypair, PROGRAM_ID, truncateReasoning, VAULT_ADDRESS } from "./config";
import type { AgentVote, AgentVotes, ConsensusDecision } from "./types";

const agent = lazyAgent();
const VAULT_RENT_EXEMPT_LAMPORTS = 890_880;
const PYTH_SOL_USD_PRICE_UPDATE_ACCOUNT = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);

export async function logDecisionOnChain(
  votes: AgentVotes,
  consensus: ConsensusDecision,
  executed: boolean,
  txSig: string | null
): Promise<string | null> {
  return retry("logDecisionOnChain", async () => {
    const vault = await fetchVault();
    const decisionIndex = vault.tradeCount + 1;
    const [decision] = PublicKey.findProgramAddressSync(
      [Buffer.from("trade_log"), VAULT_ADDRESS.toBuffer(), u32(decisionIndex)],
      PROGRAM_ID
    );

    const data = Buffer.concat([
      discriminator("global", "log_multi_agent_decision"),
      borshString("SOL-PERP"),
      encodeVote(votes.bull),
      encodeVote(votes.bear),
      encodeVote(votes.zen),
      encodeVote(consensus),
      u64(new BN(250_000_000)),
      Buffer.from([executed ? 1 : 0]),
      borshString((txSig || "").slice(0, 88)),
    ]);

    return sendIx(
      data,
      [
        writable(VAULT_ADDRESS),
        writable(decision),
        readonly(PYTH_SOL_USD_PRICE_UPDATE_ACCOUNT),
        signer(agent().publicKey),
        readonly(SystemProgram.programId),
      ],
      "log decision"
    );
  });
}

export async function updateNavOnChain(newNavLamports: number): Promise<string | null> {
  return retry("updateNavOnChain", async () => {
    const data = Buffer.concat([
      discriminator("global", "update_nav"),
      u64(new BN(Math.max(0, Math.floor(newNavLamports)))),
    ]);

    const tx = await sendIx(data, [writable(VAULT_ADDRESS), signer(agent().publicKey)], "update nav");
    await recordNavSnapshot();
    return tx;
  });
}

export async function syncVaultNav(): Promise<void> {
  try {
    const vault = await fetchVault();
    const actualBalance = await connection.getBalance(VAULT_ADDRESS);

    if (vault.nav.toNumber() === 0 && actualBalance > VAULT_RENT_EXEMPT_LAMPORTS) {
      const realNav = Math.max(actualBalance - VAULT_RENT_EXEMPT_LAMPORTS, 0);
      await updateNavOnChain(realNav);
      console.log(`[sync] NAV synced to ${realNav / 1e9} SOL`);
    } else {
      console.log(
        `[sync] NAV checked: ${vault.nav.toNumber() / 1e9} SOL stored, ${Math.max(
          actualBalance - VAULT_RENT_EXEMPT_LAMPORTS,
          0
        ) / 1e9} SOL spendable`
      );
    }
  } catch (err) {
    console.warn("[sync] NAV sync failed:", err);
  }
}

export async function recordNavSnapshot(): Promise<string | null> {
  return retry("recordNavSnapshot", async () => {
    const vault = await fetchVault();
    const [navRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("nav_record"),
        VAULT_ADDRESS.toBuffer(),
        u64(vault.navRecordCount),
      ],
      PROGRAM_ID
    );

    const data = discriminator("global", "record_nav_snapshot");
    const tx = await sendIx(
      data,
      [
        writable(VAULT_ADDRESS),
        writable(navRecord),
        signer(agent().publicKey),
        readonly(SystemProgram.programId),
      ],
      "record nav snapshot"
    );
    console.log(`[nav] snapshot recorded: ${tx}`);
    return tx;
  });
}

export async function fetchVault(): Promise<{
  agentAuthority: PublicKey;
  admin: PublicKey;
  totalDeposits: BN;
  totalShares: BN;
  nav: BN;
  tradeCount: number;
  winningTrades: number;
  isTradingPaused: boolean;
  navRecordCount: BN;
}> {
  const accountInfo = await connection.getAccountInfo(VAULT_ADDRESS);
  if (!accountInfo) throw new Error(`Vault not found: ${VAULT_ADDRESS.toBase58()}`);
  const reader = new Reader(accountInfo.data);
  reader.skip(8);
  const decoded = {
    agentAuthority: reader.publicKey(),
    admin: reader.publicKey(),
    totalDeposits: reader.u64(),
    totalShares: reader.u64(),
    nav: reader.u64(),
    tradeCount: reader.u32(),
    winningTrades: reader.u32(),
    isTradingPaused: reader.bool(),
  };
  reader.i64();
  reader.u8();
  return { ...decoded, navRecordCount: reader.u64() };
}

async function retry<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (first) {
    console.warn(`[logger] ${label} failed; retrying once`, first);
    try {
      return await fn();
    } catch (second) {
      console.warn(`[logger] ${label} failed again`, second);
      return null;
    }
  }
}

async function sendIx(
  data: Buffer,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  label: string
): Promise<string> {
  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = agent().publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(agent());
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`[logger] ${label}: ${sig}`);
  return sig;
}

function lazyAgent() {
  let cached: ReturnType<typeof loadAgentKeypair> | null = null;
  return () => {
    cached ||= loadAgentKeypair();
    return cached;
  };
}

function encodeVote(vote: AgentVote): Buffer {
  return Buffer.concat([
    Buffer.from([directionToNumber(vote.direction), Math.round(vote.leverage), vote.confidence]),
    borshString(truncateReasoning(vote.reasoning)),
  ]);
}

function directionToNumber(direction: AgentVote["direction"]): number {
  if (direction === "LONG") return 1;
  if (direction === "SHORT") return 2;
  return 0;
}

function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8);
}

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value: BN): Buffer {
  return value.toArrayLike(Buffer, "le", 8);
}

function borshString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([u32(bytes.length), bytes]);
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

class Reader {
  private offset = 0;
  constructor(private readonly data: Buffer) {}
  skip(bytes: number): void {
    this.offset += bytes;
  }
  publicKey(): PublicKey {
    const key = new PublicKey(this.data.subarray(this.offset, this.offset + 32));
    this.offset += 32;
    return key;
  }
  u8(): number {
    const value = this.data.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }
  bool(): boolean {
    return this.u8() === 1;
  }
  u32(): number {
    const value = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }
  u64(): BN {
    const value = new BN(this.data.subarray(this.offset, this.offset + 8), "le");
    this.offset += 8;
    return value;
  }
  i64(): BN {
    return this.u64();
  }
}
