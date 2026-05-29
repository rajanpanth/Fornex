import type { CurrentPosition, Direction } from "../types";

/**
 * Common interface every perp executor adapter must implement.
 *
 * Fornex's executor layer is intentionally pluggable so the agent can switch
 * between counterparties (Drift, Mango, Phoenix, ...) without changing the
 * vault, the brain, or the on-chain decision logger.
 *
 * The Synthetic executor settles against a Fornex-owned PDA price-marked by
 * Pyth, so cycles can run end-to-end even when external venues are offline
 * (see Drift devnet maintenance May 2026).
 */
export interface PerpExecutor {
  readonly name: string;

  /** Initialize whatever the adapter needs (subscriptions, accounts, etc). */
  init(): Promise<void>;

  /** Open a new position. Returns tx signature on success, null on failure. */
  open(
    direction: Exclude<Direction, "FLAT">,
    leverage: number,
    collateralSOL: number
  ): Promise<string | null>;

  /** Close any open position. Returns tx + realized PnL in SOL. */
  close(): Promise<{ txSig: string | null; realizedPnl: number } | null>;

  /** Read the current open position, if any. */
  getCurrentPosition(): Promise<CurrentPosition | null>;

  /** Cleanup. */
  shutdown(): Promise<void>;
}
