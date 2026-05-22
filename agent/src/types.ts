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

