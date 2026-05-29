import { Connection, PublicKey } from "@solana/web3.js";
import { deriveVaultStrategyPda } from "./pda";
import { Reader } from "./reader";
import { strategyModeFromByte, type VaultStrategy } from "./types";

export function decodeVaultStrategy(
  pubkey: PublicKey,
  data: Buffer
): VaultStrategy | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    const vault = r.publicKey();
    const modeByte = r.u8();
    const updatedAt = Number(r.i64());
    return {
      pubkey,
      vault,
      modeByte,
      mode: strategyModeFromByte(modeByte),
      updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the active strategy mode for a vault. Returns null when the PDA
 * isn't initialized yet — the Fornex agent treats that case as
 * `Momentum` (the on-chain default).
 */
export async function getVaultStrategy(
  connection: Connection,
  programId: PublicKey,
  vault: PublicKey
): Promise<VaultStrategy | null> {
  const [pda] = deriveVaultStrategyPda(programId, vault);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeVaultStrategy(pda, Buffer.from(info.data));
}
