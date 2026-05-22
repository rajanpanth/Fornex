use anchor_lang::prelude::*;

#[error_code]
pub enum FornexError {
    #[msg("Deposit amount must be greater than zero")]
    ZeroDeposit,

    #[msg("Insufficient shares to withdraw")]
    InsufficientShares,

    #[msg("Withdrawal amount exceeds vault balance")]
    InsufficientVaultBalance,

    #[msg("Only the AI agent authority can perform this action")]
    UnauthorizedAgent,

    #[msg("Confidence must be between 0 and 100")]
    InvalidConfidence,

    #[msg("Leverage must be between 1 and 10")]
    InvalidLeverage,

    #[msg("Direction must be 0 (Flat), 1 (Long), 2 (Short), or 3 (Close)")]
    InvalidDirection,

    #[msg("Market name is too long (max 16 characters)")]
    MarketNameTooLong,

    #[msg("Reasoning text is too long (max 512 characters)")]
    ReasoningTooLong,

    #[msg("Agent reasoning text is too long (max 200 characters)")]
    AgentReasoningTooLong,

    #[msg("Execution reference is too long (max 88 characters)")]
    ExecutionRefTooLong,

    #[msg("Arithmetic overflow occurred")]
    MathOverflow,

    #[msg("Vault NAV cannot be zero when shares exist")]
    ZeroNav,
}
