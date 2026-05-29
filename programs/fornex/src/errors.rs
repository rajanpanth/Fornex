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

    #[msg("Only the vault admin can perform this action")]
    UnauthorizedAdmin,

    #[msg("Trading is paused")]
    TradingPaused,

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

    #[msg("Deposit would mint zero vault shares")]
    ZeroShares,

    #[msg("NAV write outside the allowed bounded range")]
    NavOutOfBounds,

    #[msg("Consensus confidence is below the on-chain execution floor")]
    ConfidenceBelowFloor,

    #[msg("Per-agent leverage cap exceeded")]
    LeverageOverCap,

    #[msg("Realized PnL outside acceptable bounds for trade outcome")]
    PnlOutOfBounds,

    #[msg("Synthetic position is already closed")]
    PositionAlreadyClosed,

    #[msg("Synthetic position is still open")]
    PositionStillOpen,

    #[msg("Pyth price update is missing or stale")]
    PythPriceUnavailable,

    #[msg("Synthetic position size out of bounds")]
    SyntheticSizeOutOfBounds,

    #[msg("Per-agent reputation counter would exceed executed trade count")]
    ReputationOverflow,

    #[msg("Strategy mode must be 0 (Momentum), 1 (MeanRevert), or 2 (RangeDCA)")]
    InvalidStrategyMode,
}
