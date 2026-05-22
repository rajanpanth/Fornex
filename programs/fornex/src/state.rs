use anchor_lang::prelude::*;

/// The main vault account. Holds all state for the Fornex protocol.
/// One vault per deployment — the AI agent manages it.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    /// The AI agent's wallet — only this pubkey can log trades and update NAV
    pub agent_authority: Pubkey,
    /// The admin who initialized the vault
    pub admin: Pubkey,
    /// Total SOL deposited (in lamports)
    pub total_deposits: u64,
    /// Total shares issued to all depositors combined
    pub total_shares: u64,
    /// Current Net Asset Value of the vault (in lamports)
    /// This is what determines each share's price
    pub nav: u64,
    /// Total number of trades the agent has made
    pub trade_count: u32,
    /// Total number of winning trades (for win rate display)
    pub winning_trades: u32,
    /// Unix timestamp when the vault was created
    pub created_at: i64,
    /// PDA bump seed for deriving the vault address
    pub bump: u8,
}

/// Tracks an individual user's deposit in the vault.
/// Each user gets one of these when they first deposit.
#[account]
#[derive(InitSpace)]
pub struct UserDeposit {
    /// The user's wallet
    pub owner: Pubkey,
    /// The vault this deposit belongs to
    pub vault: Pubkey,
    /// Number of vault shares this user holds
    pub shares: u64,
    /// Total SOL this user has deposited over time (for P&L tracking)
    pub total_deposited: u64,
    /// Unix timestamp of first deposit
    pub deposited_at: i64,
    /// PDA bump seed
    pub bump: u8,
}

/// A single trade decision logged on-chain by the AI agent.
/// This is the transparency layer — anyone can audit every decision the AI made.
#[account]
#[derive(InitSpace)]
pub struct TradeLog {
    /// Which vault this trade belongs to
    pub vault: Pubkey,
    /// Trade index (1, 2, 3, ...)
    pub trade_index: u32,
    /// Market name e.g. "SOL-PERP"
    #[max_len(16)]
    pub market: String,
    /// 0 = Open Long, 1 = Open Short, 2 = Close Position, 3 = Stay Flat
    pub direction: u8,
    /// Position size in USD (scaled by 1e6 for precision)
    pub size_usd: u64,
    /// Leverage used (1-10)
    pub leverage: u8,
    /// AI's confidence score 0-100
    pub confidence: u8,
    /// The AI's reasoning — WHY it made this trade
    /// This is the magic: stored permanently on Solana for anyone to read
    #[max_len(512)]
    pub reasoning: String,
    /// Realized P&L from this trade (0 if still open, set on close)
    pub pnl_lamports: i64,
    /// Unix timestamp when this decision was made
    pub timestamp: i64,
    /// PDA bump seed
    pub bump: u8,
}
