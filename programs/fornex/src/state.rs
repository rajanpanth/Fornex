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
    pub bump: u8,
}
