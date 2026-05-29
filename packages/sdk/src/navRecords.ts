import { Connection, PublicKey } from "@solana/web3.js";
import { ACCOUNT_SIZES } from "./constants";
import { Reader } from "./reader";
import type { NavRecord } from "./types";

export function decodeNavRecord(
  pubkey: PublicKey,
  data: Buffer
): NavRecord | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    const vault = r.publicKey();
    const nav = r.u64();
    const timestamp = Number(r.i64());
    const recordIndex = r.u64();
    const tradeCount = r.u64();
    return { pubkey, vault, nav, timestamp, recordIndex, tradeCount };
  } catch {
    return null;
  }
}

/**
 * Fetch every NavRecord PDA for a vault, sorted by record index ascending.
 * Suitable for plotting equity curves or computing drawdown / Sharpe-like
 * ratios client-side.
 */
export async function getNavHistory(
  connection: Connection,
  programId: PublicKey,
  vault: PublicKey
): Promise<NavRecord[]> {
  const records = await connection.getProgramAccounts(programId, {
    filters: [
      { dataSize: ACCOUNT_SIZES.navRecord },
      { memcmp: { offset: 8, bytes: vault.toBase58() } },
    ],
  });

  return records
    .map(({ pubkey, account }) =>
      decodeNavRecord(pubkey, Buffer.from(account.data))
    )
    .filter((record): record is NavRecord => Boolean(record))
    .sort((a, b) => Number(a.recordIndex - b.recordIndex));
}
