use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::instructions::init_vault_strategy::MAX_STRATEGY_MODE;
use crate::state::{Vault, VaultStrategy};

/// Update the active strategy mode for the vault.
///
/// Admin-only. Bounded to known modes. Emits an event so the dashboard
/// can react in real time without polling.
pub fn handler(ctx: Context<SetStrategyMode>, mode: u8) -> Result<()> {
    require!(mode <= MAX_STRATEGY_MODE, FornexError::InvalidStrategyMode);

    let strat = &mut ctx.accounts.vault_strategy;
    let previous = strat.mode;
    strat.mode = mode;
    strat.updated_at = Clock::get()?.unix_timestamp;

    emit!(StrategyModeChanged {
        previous,
        next: mode,
        timestamp: strat.updated_at,
    });

    msg!(
        "Strategy mode for vault {} switched: {} -> {}",
        ctx.accounts.vault.key(),
        previous,
        mode
    );
    Ok(())
}

#[event]
pub struct StrategyModeChanged {
    pub previous: u8,
    pub next: u8,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct SetStrategyMode<'info> {
    #[account(
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.admin == admin.key() @ FornexError::UnauthorizedAdmin,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"vault_strategy", vault.key().as_ref()],
        bump = vault_strategy.bump,
        constraint = vault_strategy.vault == vault.key() @ FornexError::UnauthorizedAdmin,
    )]
    pub vault_strategy: Account<'info, VaultStrategy>,

    #[account(mut)]
    pub admin: Signer<'info>,
}
