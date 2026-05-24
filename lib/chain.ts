import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";

/* ── Constants ──────────────────────────────────────────── */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw"
);

export const VAULT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS || PublicKey.default.toBase58()
);

/* ── Types ──────────────────────────────────────────────── */
export type Vote = {
  direction: number;   // 0=FLAT, 1=LONG, 2=SHORT
  leverage: number;
  confidence: number;
  reasoning: string;
  reasoningBytes: number[];
};

export type Decision = {
  pubkey: PublicKey;
  decisionIndex: number;
  market: string;
  bullVote: Vote;
  bearVote: Vote;
  zenVote: Vote;
  consensus: Vote;
  sizeUsd: number;
  executed: boolean;
  executionRef: string;
  timestamp: number;
};

export type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  body: string;
  tx?: string;
};

export type VaultData = {
  agentAuthority: PublicKey;
  admin: PublicKey;
  totalDeposits: bigint;
  totalShares: bigint;
  nav: bigint;
  tradeCount: number;
  winningTrades: number;
  isTradingPaused: boolean;
};

/* ── Binary Reader ──────────────────────────────────────── */
export class Reader {
  private offset = 0;
  constructor(private data: Buffer) {}

  skip(n: number) { this.offset += n; }

  publicKey() {
    const k = new PublicKey(this.data.subarray(this.offset, this.offset + 32));
    this.offset += 32;
    return k;
  }

  u8() { const v = this.data.readUInt8(this.offset); this.offset += 1; return v; }
  bool() { return this.u8() === 1; }
  u32() { const v = this.data.readUInt32LE(this.offset); this.offset += 4; return v; }
  u64() { const v = this.data.readBigUInt64LE(this.offset); this.offset += 8; return v; }

  fixedString(size: number) {
    const b = this.fixedBytes(size);
    const end = b.indexOf(0);
    return b.subarray(0, end === -1 ? size : end).toString("utf8");
  }

  fixedBytes(size: number) {
    const b = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return b;
  }

  vote(): Vote {
    const direction = this.u8();
    const leverage = this.u8();
    const confidence = this.u8();
    const reasoningBytes = this.fixedBytes(200);
    const end = reasoningBytes.indexOf(0);
    return {
      direction,
      leverage,
      confidence,
      reasoning: reasoningBytes
        .subarray(0, end === -1 ? reasoningBytes.length : end)
        .toString("utf8"),
      reasoningBytes: Array.from(reasoningBytes),
    };
  }

  skipU64AfterPnl() { this.offset += 8; return this.u64(); }
}

/* ── Decoders ───────────────────────────────────────────── */
export function decodeVault(data: Buffer): VaultData {
  const r = new Reader(data);
  r.skip(8);
  return {
    agentAuthority: r.publicKey(),
    admin: r.publicKey(),
    totalDeposits: r.u64(),
    totalShares: r.u64(),
    nav: r.u64(),
    tradeCount: r.u32(),
    winningTrades: r.u32(),
    isTradingPaused: r.bool(),
  };
}

export function decodeDecision(pubkey: PublicKey, data: Buffer): Decision | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    r.publicKey(); // vault
    return {
      pubkey,
      decisionIndex: r.u32(),
      market: r.fixedString(16),
      bullVote: r.vote(),
      bearVote: r.vote(),
      zenVote: r.vote(),
      consensus: r.vote(),
      sizeUsd: Number(r.u64()),
      executed: r.bool(),
      executionRef: r.fixedString(88),
      timestamp: Number(r.skipU64AfterPnl()),
    };
  } catch {
    return null;
  }
}

/* ── Instruction Helpers ────────────────────────────────── */
export async function discriminator(ns: string, name: string) {
  const b = new TextEncoder().encode(`${ns}:${name}`);
  const h = await crypto.subtle.digest("SHA-256", b);
  return Buffer.from(h).subarray(0, 8);
}

export function u64(v: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

export function readonly(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: false };
}

export function writable(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: true };
}

export function signer(pubkey: PublicKey) {
  return { pubkey, isSigner: true, isWritable: true };
}

/* ── Formatting ─────────────────────────────────────────── */
export function dirLabel(d: number) {
  if (d === 1) return "LONG";
  if (d === 2) return "SHORT";
  return "FLAT";
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
