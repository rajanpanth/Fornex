use anchor_lang::prelude::*;
use crate::state::{Vault, TradeLog};
use crate::errors::FornexError;

/// AI agent logs a trade decision on-chain.
/// This is the transparency layer — the "AI reasoning feed" in the frontend
/// reads directly from these on-chain logs.
///
/// Only the vault's agent_authority can call this.
/// Each trade creates a new TradeLog PDA with a unique index.
pub fn handler(
    ctx: Context<LogTrade>,
    market: String,
    direction: u8,
    size_usd: u64,
    leverage: u8,
    confidence: u8,
    reasoning: String,
) -> Result<()> {
    // Validate inputs
    require!(direction <= 3, FornexError::InvalidDirection);
    require!(leverage >= 1 && leverage <= 10, FornexError::InvalidLeverage);
    require!(confidence <= 100, FornexError::InvalidConfidence);
    require!(market.len() <= 16, FornexError::MarketNameTooLong);
    require!(reasoning.len() <= 512, FornexError::ReasoningTooLong);

    let vault = &mut ctx.accounts.vault;
    let trade_log = &mut ctx.accounts.trade_log;
    let clock = Clock::get()?;

    // Increment trade count
    vault.trade_count = vault.trade_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;

    // Fill in the trade log
    trade_log.vault = ctx.accounts.vault.key();
    trade_log.trade_index = vault.trade_count;
    trade_log.market = market;
    trade_log.direction = direction;
    trade_log.size_usd = size_usd;
    trade_log.leverage = leverage;
    trade_log.confidence = confidence;
    trade_log.reasoning = reasoning;
    trade_log.pnl_lamports = 0; // Set later when position closes
    trade_log.timestamp = clock.unix_timestamp;
    trade_log.bump = ctx.bumps.trade_log;

    let dir_label = match direction {
        0 => "LONG",
        1 => "SHORT",
        2 => "CLOSE",
        _ => "FLAT",
    };

    msg!(
        "Trade #{}: {} {} | {}x | Confidence: {}% | {}",
        vault.trade_count,
        dir_label,
        trade_log.market,
        leverage,
        confidence,
        trade_log.reasoning
    );

    Ok(())
}

#[derive(Accounts)]
pub struct LogTrade<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        // CRITICAL: Only the AI agent can log trades
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = agent,
        space = 8 + TradeLog::INIT_SPACE,
        seeds = [
            b"trade_log",
            vault.key().as_ref(),
            &(vault.trade_count + 1).to_le_bytes()
        ],
        bump
    )]
    pub trade_log: Account<'info, TradeLog>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
