use anchor_lang::prelude::*;
use crate::state::{Vault, UserDeposit};
use crate::errors::FornexError;

pub fn handler(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, FornexError::InsufficientShares);

    // Validate shares before any mutable borrows
    require!(
        ctx.accounts.user_deposit.shares >= shares_to_burn,
        FornexError::InsufficientShares
    );

    // Read vault state values before mutable borrows
    let nav = ctx.accounts.vault.nav;
    let total_shares = ctx.accounts.vault.total_shares;
    let user_key = ctx.accounts.user.key();

    let sol_out = (shares_to_burn as u128)
        .checked_mul(nav as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(FornexError::MathOverflow)? as u64;

    require!(sol_out > 0, FornexError::InsufficientVaultBalance);

    // Transfer lamports from vault PDA → user via AccountInfo manipulation
    // Must be done before any Anchor mutable borrow on vault
    let vault_info = ctx.accounts.vault.to_account_info();
    let user_info = ctx.accounts.user.to_account_info();
    **vault_info.try_borrow_mut_lamports()? -= sol_out;
    **user_info.try_borrow_mut_lamports()? += sol_out;

    // Now update Anchor account state (mutable borrows)
    ctx.accounts.vault.total_shares = ctx.accounts.vault.total_shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;
    ctx.accounts.vault.nav = ctx.accounts.vault.nav
        .checked_sub(sol_out)
        .ok_or(FornexError::MathOverflow)?;
    ctx.accounts.user_deposit.shares = ctx.accounts.user_deposit.shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "Withdraw: {} shares burned → {} lamports returned to {}",
        shares_to_burn, sol_out, user_key
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"user_deposit", vault.key().as_ref(), user.key().as_ref()],
        bump = user_deposit.bump,
        constraint = user_deposit.owner == user.key()
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}
