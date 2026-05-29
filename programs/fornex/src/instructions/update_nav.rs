use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::FornexError;

pub fn handler(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Block NAV updates during emergency pause
    require!(
        !vault.is_trading_paused,
        FornexError::TradingPaused
    );

    let old_nav = vault.nav;

    // Bounded NAV writes — both directions — to prevent share-price oracle abuse.
    // Cap drawdown at 25% per single update once the vault is established.
    // Cap upside at 10% per single update so an attacker who steals the agent
    // key cannot inflate NAV to mint near-zero shares for a victim depositor.
    if vault.nav > 0 && vault.total_shares > 0 {
        let floor = vault
            .nav
            .checked_mul(75)
            .ok_or(FornexError::MathOverflow)?
            .checked_div(100)
            .ok_or(FornexError::MathOverflow)?;
        let ceil = vault
            .nav
            .checked_mul(110)
            .ok_or(FornexError::MathOverflow)?
            .checked_div(100)
            .ok_or(FornexError::MathOverflow)?;
        require!(
            new_nav >= floor && new_nav <= ceil,
            FornexError::NavOutOfBounds
        );
    }

    // Minimum NAV floor while shares exist (prevent division-by-zero on next deposit)
    if vault.total_shares > 0 {
        require!(new_nav >= 1000, FornexError::ZeroNav);
    }

    // NOTE: winning_trades is no longer incremented here. NAV ticks up on every
    // deposit, so this conflated user inflows with realized trade wins. Wins
    // are now recorded by `record_trade_outcome` after a position is closed.

    vault.nav = new_nav;

    let change_bps = if old_nav > 0 {
        ((new_nav as i128 - old_nav as i128) * 10000 / old_nav as i128) as i64
    } else {
        0
    };

    emit!(NavUpdatedEvent {
        old_nav,
        new_nav,
        trade_count: vault.trade_count as u64,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "NAV updated: {} → {} lamports ({}bps change)",
        old_nav, new_nav, change_bps
    );

    Ok(())
}

#[event]
pub struct NavUpdatedEvent {
    pub old_nav: u64,
    pub new_nav: u64,
    pub trade_count: u64,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct UpdateNav<'info> {
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
