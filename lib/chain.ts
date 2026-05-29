import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";

/* ── Constants ──────────────────────────────────────────── */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"
);

export const VAULT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
    "HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR"
);

export const VAULT_MINT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_FNRX_MINT_ADDRESS ||
    "BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj"
);

/**
 * RPC URL used by direct browser callers. On the client we route through
 * /api/rpc so the Helius key is never bundled and 429s are absorbed by a
 * server-side cache. On the server (SSR / API routes) we use the
 * upstream RPC directly via the public env.
 */
export const RPC_URL: string =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      "https://api.devnet.solana.com";

export const DECISION_ACCOUNT_SIZE =
  8 + 32 + 4 + 16 + 4 * 203 + 8 + 1 + 88 + 8 + 8 + 8 + 8 + 1;

export const LEGACY_DECISION_ACCOUNT_SIZE =
  8 + 32 + 4 + 16 + 4 * 203 + 8 + 1 + 88 + 8 + 8 + 1;

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
  solPriceVerified: number;
  priceConfidence: number;
};

export type NavRecordData = {
  pubkey: PublicKey;
  vault: PublicKey;
  nav: bigint;
  timestamp: number;
  recordIndex: bigint;
  tradeCount: bigint;
};

/**
 * Per-agent reputation, derived on-chain from realized trade outcomes.
 *
 * Stored at PDA ["agent_reputation", VAULT_ADDRESS]. May not exist on
 * deployments that haven't run admin `init_agent_reputation` yet - the
 * frontend treats `null` as "not initialized" and renders an empty state.
 */
export type AgentReputationData = {
  pubkey: PublicKey;
  vault: PublicKey;
  bullCorrect: number;
  bullTotal: number;
  bearCorrect: number;
  bearTotal: number;
  zenCorrect: number;
  zenTotal: number;
  lastUpdated: number;
};

/** Vault-level strategy mode. Mirrors the on-chain `VaultStrategy.mode` byte. */
export type StrategyModeLabel = "Momentum" | "MeanRevert" | "RangeDCA";

export type VaultStrategyData = {
  pubkey: PublicKey;
  vault: PublicKey;
  mode: number; // 0 / 1 / 2
  modeLabel: StrategyModeLabel;
  updatedAt: number;
};

export type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  body: string;
  tx?: string;
  link?: {
    href: string;
    label: string;
  };
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
  navRecordCount: bigint;
  executedTradeCount: number;
  inceptionNav: bigint;
};

/* ── Binary Reader ──────────────────────────────────────── */
export class Reader {
  private offset = 0;
  constructor(data: Buffer | Uint8Array) {
    // web3.js may return Uint8Array in browser context; ensure Buffer methods exist
    this.data = Buffer.from(data) as Buffer;
  }
  private data: Buffer;

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
  i64() { const v = this.data.readBigInt64LE(this.offset); this.offset += 8; return v; }

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
  const vault = {
    agentAuthority: r.publicKey(),
    admin: r.publicKey(),
    totalDeposits: r.u64(),
    totalShares: r.u64(),
    nav: r.u64(),
    tradeCount: r.u32(),
    winningTrades: r.u32(),
    isTradingPaused: r.bool(),
  };
  r.i64();
  r.u8();
  // Fields below are appended by migrations; older accounts may be shorter.
  // Constants reflect cumulative byte offsets after the base struct above.
  const BASE_LEN = 8 + 32 + 32 + 8 + 8 + 8 + 4 + 4 + 1 + 8 + 1; // 122
  const navRecordCount = data.length >= BASE_LEN + 8 ? r.u64() : 0n;
  const executedTradeCount = data.length >= BASE_LEN + 8 + 4 ? r.u32() : 0;
  const inceptionNav = data.length >= BASE_LEN + 8 + 4 + 8 ? r.u64() : 0n;
  return {
    ...vault,
    navRecordCount,
    executedTradeCount,
    inceptionNav,
  };
}

export function decodeNavRecord(pubkey: PublicKey, data: Buffer): NavRecordData | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    return {
      pubkey,
      vault: r.publicKey(),
      nav: r.u64(),
      timestamp: Number(r.i64()),
      recordIndex: r.u64(),
      tradeCount: r.u64(),
    };
  } catch {
    return null;
  }
}

/**
 * Decode an `AgentReputation` PDA. Layout (matches state.rs):
 *   discriminator (8) · vault (32) · bull_correct (4) · bull_total (4) ·
 *   bear_correct (4) · bear_total (4) · zen_correct (4) · zen_total (4) ·
 *   last_updated (8 i64) · bump (1).
 */
export function decodeAgentReputation(
  pubkey: PublicKey,
  data: Buffer
): AgentReputationData | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    const vault = r.publicKey();
    const bullCorrect = r.u32();
    const bullTotal = r.u32();
    const bearCorrect = r.u32();
    const bearTotal = r.u32();
    const zenCorrect = r.u32();
    const zenTotal = r.u32();
    const lastUpdated = Number(r.i64());
    return {
      pubkey,
      vault,
      bullCorrect,
      bullTotal,
      bearCorrect,
      bearTotal,
      zenCorrect,
      zenTotal,
      lastUpdated,
    };
  } catch {
    return null;
  }
}

/**
 * Compute the PDA for the agent-reputation account belonging to `vault`.
 * Mirrors the seeds used in the Anchor program.
 */
export function deriveAgentReputationPda(vault: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_reputation"), vault.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/** Compute the PDA for the vault-strategy account. */
export function deriveVaultStrategyPda(vault: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_strategy"), vault.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Decode a `VaultStrategy` PDA. Layout (matches state.rs::VaultStrategy):
 *   discriminator (8) · vault (32) · mode (1) · updated_at (8 i64) · bump (1).
 */
export function decodeVaultStrategy(
  pubkey: PublicKey,
  data: Buffer
): VaultStrategyData | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    const vault = r.publicKey();
    const mode = r.u8();
    const updatedAt = Number(r.i64());
    return {
      pubkey,
      vault,
      mode,
      modeLabel: strategyLabelFromMode(mode),
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function strategyLabelFromMode(mode: number): StrategyModeLabel {
  if (mode === 1) return "MeanRevert";
  if (mode === 2) return "RangeDCA";
  return "Momentum";
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
      solPriceVerified:
        data.length >= DECISION_ACCOUNT_SIZE ? Number(r.u64()) : 0,
      priceConfidence:
        data.length >= DECISION_ACCOUNT_SIZE ? Number(r.u64()) : 0,
    };
  } catch (e) {
    console.error('[fornex] decodeDecision failed:', e);
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
