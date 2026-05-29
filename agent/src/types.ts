export type Direction = "LONG" | "SHORT" | "FLAT";

export interface MarketSignals {
  fundingRate: number;
  oiChange: number;
  lsRatio: number;
  markIndexSpread: number;
  liqWallPrice: number;
  currentPrice: number;
  timestamp: number;
}

export interface AgentVote {
  direction: Direction;
  leverage: number;
  confidence: number;
  reasoning: string;
}

export interface AgentVotes {
  bull: AgentVote;
  bear: AgentVote;
  zen: AgentVote;
}

export interface ConsensusDecision extends AgentVote {
  shouldExecute: boolean;
  agreeingCount: number;
}

export interface CurrentPosition {
  direction: "LONG" | "SHORT";
  baseAssetAmount: number;
  quoteEntryAmount?: number;
  entryPrice?: number;
  leverage?: number;
  unrealizedPnl?: number;
  liquidationPrice?: number;
}

/**
 * Vault-level strategy mode. Selects which prompt set the brain runs at
 * the top of every cycle. The active mode is read from the on-chain
 * `VaultStrategy` PDA at ["vault_strategy", vault]. Admin can switch
 * modes with `set_strategy_mode`.
 */
export type StrategyMode = "momentum" | "meanRevert" | "rangeDCA";

/**
 * Map an on-chain `VaultStrategy.mode` byte to the runtime label used by
 * the brain. Falls back to "momentum" when the PDA is missing or the
 * mode byte is out of range — the on-chain instruction validates the
 * range, so this is purely a defensive default.
 */
export function strategyModeFromByte(byte: number | null | undefined): StrategyMode {
  switch (byte) {
    case 1:
      return "meanRevert";
    case 2:
      return "rangeDCA";
    case 0:
    default:
      return "momentum";
  }
}


