use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub agent_authority: Pubkey,
    pub admin: Pubkey,
    pub total_deposits: u64,
    pub total_shares: u64,
    pub nav: u64,
    pub trade_count: u32,
    pub winning_trades: u32,
    pub is_trading_paused: bool,
    pub created_at: i64,
    pub bump: u8,
    pub nav_record_count: u64,
    pub executed_trade_count: u32,
    pub inception_nav: u64,
    pub synthetic_position_count: u32,
}

#[account]
#[derive(InitSpace)]
pub struct UserDeposit {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub shares: u64,
    pub total_deposited: u64,
    pub deposited_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TradeLog {
    pub vault: Pubkey,
    pub trade_index: u32,
    pub market: [u8; 16],
    pub direction: u8,
    pub size_usd: u64,
    pub leverage: u8,
    pub confidence: u8,
    pub reasoning: [u8; 512],
    pub pnl_lamports: i64,
    pub timestamp: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AgentVote {
    pub direction: u8,
    pub leverage: u8,
    pub confidence: u8,
    pub reasoning: [u8; 200],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AgentVoteInput {
    pub direction: u8,
    pub leverage: u8,
    pub confidence: u8,
    pub reasoning: String,
}

#[account]
#[derive(InitSpace)]
pub struct MultiAgentDecision {
    pub vault: Pubkey,
    pub decision_index: u32,
    pub market: [u8; 16],
    pub bull_vote: AgentVote,
    pub bear_vote: AgentVote,
    pub zen_vote: AgentVote,
    pub consensus: AgentVote,
    pub size_usd: u64,
    pub executed: bool,
    pub execution_ref: [u8; 88],
    pub pnl_lamports: i64,
    pub timestamp: i64,
    pub sol_price_verified: u64,
    pub price_confidence: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct NavRecord {
    pub vault: Pubkey,
    pub nav: u64,
    pub timestamp: i64,
    pub record_index: u64,
    pub trade_count: u64,
    pub bump: u8,
}

/// On-chain synthetic perpetual position. Price-marked against Pyth at open
/// and close. Used by the Synthetic executor adapter while external dex
/// integrations (Drift, Mango) are unavailable or still being integrated.
///
/// PnL formula:
///   LONG:  pnl_lamports = collateral_lamports * leverage * (close - entry) / entry
///   SHORT: pnl_lamports = collateral_lamports * leverage * (entry - close) / entry
///
/// Both directions are bounded to ±50% of NAV via record_trade_outcome.
#[account]
#[derive(InitSpace)]
pub struct SyntheticPosition {
    pub vault: Pubkey,
    pub position_index: u32,
    pub direction: u8,            // 1 = LONG, 2 = SHORT
    pub leverage: u8,             // 1..=3
    pub entry_price: u64,         // Pyth-stamped at open (price * 1e8)
    pub close_price: u64,         // Pyth-stamped at close (0 while open)
    pub collateral_lamports: u64,
    pub size_usd: u64,
    pub opened_at: i64,
    pub closed_at: i64,           // 0 while open
    pub realized_pnl_lamports: i64,
    pub is_open: bool,
    pub bump: u8,
}

/// Per-agent reputation, derived from on-chain trade outcomes.
///
/// On every closed trade, `update_agent_reputation` is called by the agent
/// authority with the realized PnL sign and each persona's last vote
/// direction. An agent gets credit when its vote direction matches the PnL
/// sign (LONG + positive PnL → correct, SHORT + negative price move →
/// correct, FLAT skips both counters because there's no directional call).
///
/// All counters are monotonic and bounded by `total_calls`, which is itself
/// bounded by `vault.executed_trade_count`. The vault PDA is the only
/// account that can mutate this state, gated by the agent authority.
#[account]
#[derive(InitSpace)]
pub struct AgentReputation {
    pub vault: Pubkey,

    pub bull_correct: u32,
    pub bull_total: u32,
    pub bear_correct: u32,
    pub bear_total: u32,
    pub zen_correct: u32,
    pub zen_total: u32,

    pub last_updated: i64,
    pub bump: u8,
}

/// Vault-level strategy mode. Admin sets the mode at deploy time and may
/// change it later; the agent reads the current mode at the top of every
/// cycle and switches its three system prompts accordingly.
///
/// PDA seeds: ["vault_strategy", vault.key()]
///
/// Modes:
///   0 = Momentum    — funding/OI/L-S-driven trend follow with squeeze bias.
///   1 = MeanRevert  — fade overextensions, weight on mark/index spread + L/S.
///   2 = RangeDCA    — staged entries inside ranges, exit on regime break.
///
/// This is the on-chain expression of "programmable execution" — judges can
/// see exactly which prompt set is active by reading one byte on Solana.
#[account]
#[derive(InitSpace)]
pub struct VaultStrategy {
    pub vault: Pubkey,
    pub mode: u8,
    pub updated_at: i64,
    pub bump: u8,
}
