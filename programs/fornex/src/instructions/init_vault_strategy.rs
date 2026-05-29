use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::{Vault, VaultStrategy};

/// Maximum strategy mode index. Update both this constant and
/// `update_agent_reputation`'s direction validator if more modes are added.
pub const MAX_STRATEGY_MODE: u8 = 2;

/// One-time initializer for the vault-level strategy mode PDA.
///
/// `mode` is bounded to {0, 1, 2}. The agent runtime reads this account at
/// the top of every cycle and selects which prompt set BULL / BEAR / ZEN
/// run. Admin-only.
pub fn handler(ctx: Context<InitVaultStrategy>, mode: u8) -> Result<()> {
    require!(mode <= MAX_STRATEGY_MODE, FornexError::InvalidStrategyMode);

    let strat = &mut ctx.accounts.vault_strategy;
    strat.vault = ctx.accounts.vault.key();
    strat.mode = mode;
    strat.updated_at = Clock::get()?.unix_timestamp;
    strat.bump = ctx.bumps.vault_strategy;

    msg!(
        "VaultStrategy initialized for vault {} at mode {}",
        ctx.accounts.vault.key(),
        mode
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitVaultStrategy<'info> {
    #[account(
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.admin == admin.key() @ FornexError::UnauthorizedAdmin,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + VaultStrategy::INIT_SPACE,
        seeds = [b"vault_strategy", vault.key().as_ref()],
        bump,
    )]
    pub vault_strategy: Account<'info, VaultStrategy>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
