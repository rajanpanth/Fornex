import { PublicKey } from "@solana/web3.js";

import { connection, PROGRAM_ID, VAULT_ADDRESS } from "./config";
import { strategyModeFromByte, type StrategyMode } from "./types";

/**
 * Read the active strategy mode from the on-chain `VaultStrategy` PDA.
 *
 * Layout (matches programs/fornex/src/state.rs::VaultStrategy):
 *   8  discriminator
 *   32 vault pubkey
 *   1  mode (u8)
 *   8  updated_at (i64)
 *   1  bump
 *
 * Returns "momentum" when the PDA hasn't been initialized yet, so the
 * runtime keeps working on deployments that pre-date the v0.4 upgrade.
 */
export async function fetchStrategyMode(): Promise<StrategyMode> {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_strategy"), VAULT_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    const info = await connection.getAccountInfo(pda);
    if (!info) return "momentum";
    // Mode byte sits at offset 8 (anchor discriminator) + 32 (vault key) = 40.
    const modeByte = info.data[40];
    return strategyModeFromByte(modeByte);
  } catch (error) {
    console.warn("[strategy] failed to read mode; defaulting to momentum", error);
    return "momentum";
  }
}
