import { PublicKey } from "@solana/web3.js";

/** Compute the canonical Vault PDA: ["vault"]. */
export function deriveVaultPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("vault")], programId);
}

/** PDA for a specific decision: ["decision", vault, decision_index_le_u32]. */
export function deriveDecisionPda(
  programId: PublicKey,
  vault: PublicKey,
  decisionIndex: number
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(decisionIndex >>> 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("decision"), vault.toBuffer(), indexBuf],
    programId
  );
}

/** PDA for a NAV snapshot: ["nav_record", vault, record_index_le_u64]. */
export function deriveNavRecordPda(
  programId: PublicKey,
  vault: PublicKey,
  recordIndex: bigint
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(recordIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nav_record"), vault.toBuffer(), indexBuf],
    programId
  );
}

/** PDA for a synthetic position: ["synthetic_position", vault, position_index_le_u32]. */
export function deriveSyntheticPositionPda(
  programId: PublicKey,
  vault: PublicKey,
  positionIndex: number
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(positionIndex >>> 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("synthetic_position"), vault.toBuffer(), indexBuf],
    programId
  );
}

/** PDA for the per-agent reputation account: ["agent_reputation", vault]. */
export function deriveAgentReputationPda(
  programId: PublicKey,
  vault: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent_reputation"), vault.toBuffer()],
    programId
  );
}

/** PDA for the vault strategy mode: ["vault_strategy", vault]. */
export function deriveVaultStrategyPda(
  programId: PublicKey,
  vault: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_strategy"), vault.toBuffer()],
    programId
  );
}
