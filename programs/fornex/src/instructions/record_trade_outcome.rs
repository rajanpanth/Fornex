use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::Vault;

pub fn handler(ctx: Context<RecordTradeOutcome>, pnl_lamports: i64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Sanity bound: a single trade cannot move more than ±50% of current NAV.
    // Prevents the agent key (if compromised) from registering nonsense PnL
    // that gates the win-rate metric and trade counters.
    let abs_pnl = pnl_lamports.unsigned_abs();
    if vault.nav > 0 {
        let cap = vault
            .nav
            .checked_div(2)
            .ok_or(FornexError::MathOverflow)?;
        require!(abs_pnl <= cap, FornexError::PnlOutOfBounds);
    }

    vault.executed_trade_count = vault
        .executed_trade_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;

    if pnl_lamports > 0 {
        vault.winning_trades = vault
            .winning_trades
            .checked_add(1)
            .ok_or(FornexError::MathOverflow)?;
    }

    emit!(TradeOutcomeEvent {
        executed_trade_count: vault.executed_trade_count,
        winning_trades: vault.winning_trades,
        pnl_lamports,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Trade outcome #{}: PnL {} lamports | wins {}/{}",
        vault.executed_trade_count,
        pnl_lamports,
        vault.winning_trades,
        vault.executed_trade_count
    );
    Ok(())
}

#[event]
pub struct TradeOutcomeEvent {
    pub executed_trade_count: u32,
    pub winning_trades: u32,
    pub pnl_lamports: i64,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct RecordTradeOutcome<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub agent: Signer<'info>,
}
