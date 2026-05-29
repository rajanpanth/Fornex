import { PublicKey } from "@solana/web3.js";

/** Live Fornex deployment on Solana devnet. */
export const FORNEX_DEVNET = {
  programId: new PublicKey("H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf"),
  vault: new PublicKey("HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR"),
  fnrxMint: new PublicKey("BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj"),
};

/**
 * Account size constants. These match the Anchor account layouts in
 * `programs/fornex/src/state.rs`. Bumping the program changes one of
 * these requires a corresponding bump here.
 */
export const ACCOUNT_SIZES = {
  /** Current `MultiAgentDecision` PDA size (post-Pyth fields). */
  decision: 1002,
  /** Pre-Pyth legacy decision PDA size, still valid for historical reads. */
  decisionLegacy: 986,
  /** `NavRecord` PDA size. */
  navRecord: 8 + 32 + 8 + 8 + 8 + 8 + 1,
} as const;
