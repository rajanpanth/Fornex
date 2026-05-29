import { PublicKey } from "@solana/web3.js";

export type AgentVote = {
  /** 0 = FLAT, 1 = LONG, 2 = SHORT. */
  direction: number;
  leverage: number;
  confidence: number;
  /** Truncated UTF-8 decoded reasoning. */
  reasoning: string;
  /** Raw 200-byte reasoning slice from the account, useful for hashing. */
  reasoningBytes: number[];
};

export type Decision = {
  pubkey: PublicKey;
  decisionIndex: number;
  market: string;
  bullVote: AgentVote;
  bearVote: AgentVote;
  zenVote: AgentVote;
  consensus: AgentVote;
  sizeUsd: bigint;
  executed: boolean;
  executionRef: string;
  pnlLamports: bigint;
  timestamp: number;
  /** SOL/USD as price * 1e8 at decision time, sourced from Pyth on-chain. */
  solPriceVerified: bigint;
  /** Pyth price confidence interval as price * 1e8. */
  priceConfidence: bigint;
};

export type Vault = {
  pubkey: PublicKey;
  agentAuthority: PublicKey;
  admin: PublicKey;
  totalDeposits: bigint;
  totalShares: bigint;
  /** Net asset value in lamports. */
  nav: bigint;
  tradeCount: number;
  winningTrades: number;
  isTradingPaused: boolean;
  navRecordCount: bigint;
  /** Number of trades whose realized PnL was recorded on chain. */
  executedTradeCount: number;
  /** NAV stamped at first deposit. Anchors PnL since inception. */
  inceptionNav: bigint;
  syntheticPositionCount: number;
};

export type NavRecord = {
  pubkey: PublicKey;
  vault: PublicKey;
  nav: bigint;
  timestamp: number;
  recordIndex: bigint;
  tradeCount: bigint;
};

export type AgentReputation = {
  pubkey: PublicKey;
  vault: PublicKey;
  bullCorrect: number;
  bullTotal: number;
  bearCorrect: number;
  bearTotal: number;
  zenCorrect: number;
  zenTotal: number;
  lastUpdated: number;
};

export type StrategyMode = "Momentum" | "MeanRevert" | "RangeDCA";

export type VaultStrategy = {
  pubkey: PublicKey;
  vault: PublicKey;
  modeByte: number;
  mode: StrategyMode;
  updatedAt: number;
};

export function strategyModeFromByte(byte: number): StrategyMode {
  if (byte === 1) return "MeanRevert";
  if (byte === 2) return "RangeDCA";
  return "Momentum";
}
