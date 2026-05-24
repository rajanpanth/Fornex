use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::Vault;

pub fn pause(ctx: Context<EmergencyPause>) -> Result<()> {
    ctx.accounts.vault.is_trading_paused = true;
    msg!("Fornex trading paused by admin {}", ctx.accounts.admin.key());
    Ok(())
}

pub fn resume(ctx: Context<EmergencyPause>) -> Result<()> {
    ctx.accounts.vault.is_trading_paused = false;
    msg!("Fornex trading resumed by admin {}", ctx.accounts.admin.key());
    Ok(())
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.admin == admin.key() @ FornexError::UnauthorizedAdmin
    )]
    pub vault: Account<'info, Vault>,

    pub admin: Signer<'info>,
}
