import { DriftExecutor } from "./drift";
import { SyntheticExecutor } from "./synthetic";
import type { PerpExecutor } from "./types";

export type { PerpExecutor } from "./types";

/**
 * Pluggable executor selection.
 *
 *   FORNEX_EXECUTOR=synthetic  (default) → on-chain Pyth-marked synthetic perps
 *   FORNEX_EXECUTOR=drift                → Drift Protocol devnet integration
 *
 * The synthetic executor is the production default while Drift devnet is in
 * maintenance (April 2026 hack mitigation). When Drift is back, switch by
 * setting FORNEX_EXECUTOR=drift in agent/.env.
 */
export function makeExecutor(): PerpExecutor {
  const choice = (process.env.FORNEX_EXECUTOR || "synthetic").toLowerCase();
  switch (choice) {
    case "drift":
      return new DriftExecutor();
    case "synthetic":
    default:
      return new SyntheticExecutor();
  }
}

const active = makeExecutor();

export const executor: PerpExecutor = active;
export const initExecutor = () => active.init();
export const openPosition = (...args: Parameters<PerpExecutor["open"]>) =>
  active.open(...args);
export const closePosition = () => active.close();
export const getCurrentPosition = () => active.getCurrentPosition();
export const shutdownExecutor = () => active.shutdown();

// Expose the name so logging/diagnostics can advertise which adapter is live.
export const executorName = active.name;

// Backwards-compat helper (the old getVaultPnL behaviour: read unrealized PnL
// from the open position). The synthetic executor doesn't have unrealized PnL
// (PnL only materializes at close), so this returns 0 there.
export async function getVaultPnL(): Promise<number> {
  try {
    const pos = await active.getCurrentPosition();
    return pos?.unrealizedPnl ?? 0;
  } catch {
    return 0;
  }
}
