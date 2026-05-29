import { Connection, PublicKey } from "@solana/web3.js";
import { Reader } from "./reader";
import type { Vault } from "./types";

/**
 * Decode a Vault account. Layout is appended-only across program versions:
 * older accounts may be shorter, so trailing fields default to 0/0n.
 */
export function decodeVault(pubkey: PublicKey, data: Buffer): Vault {
  const r = new Reader(data);
  r.skip(8); // anchor discriminator
  const agentAuthority = r.publicKey();
  const admin = r.publicKey();
  const totalDeposits = r.u64();
  const totalShares = r.u64();
  const nav = r.u64();
  const tradeCount = r.u32();
  const winningTrades = r.u32();
  const isTradingPaused = r.bool();
  r.i64(); // created_at — unused publicly
  r.u8(); // bump

  const navRecordCount = r.remaining() >= 8 ? r.u64() : 0n;
  const executedTradeCount = r.remaining() >= 4 ? r.u32() : 0;
  const inceptionNav = r.remaining() >= 8 ? r.u64() : 0n;
  const syntheticPositionCount = r.remaining() >= 4 ? r.u32() : 0;

  return {
    pubkey,
    agentAuthority,
    admin,
    totalDeposits,
    totalShares,
    nav,
    tradeCount,
    winningTrades,
    isTradingPaused,
    navRecordCount,
    executedTradeCount,
    inceptionNav,
    syntheticPositionCount,
  };
}

/** Fetch and decode the Vault account for a known PDA. Returns null if missing. */
export async function getVault(
  connection: Connection,
  vault: PublicKey
): Promise<Vault | null> {
  const info = await connection.getAccountInfo(vault);
  if (!info) return null;
  return decodeVault(vault, Buffer.from(info.data));
}
