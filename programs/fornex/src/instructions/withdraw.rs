use anchor_lang::prelude::*;
use crate::state::{Vault, UserDeposit};
use crate::errors::FornexError;

pub fn handler(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, FornexError::InsufficientShares);

    let user_deposit = &mut ctx.accounts.user_deposit;
    require!(
        user_deposit.shares >= shares_to_burn,
        FornexError::InsufficientShares
    );

    let vault = &mut ctx.accounts.vault;

    let sol_out = (shares_to_burn as u128)
        .checked_mul(vault.nav as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(vault.total_shares as u128)
        .ok_or(FornexError::MathOverflow)? as u64;

    require!(sol_out > 0, FornexError::InsufficientVaultBalance);

    **vault_account_info.try_borrow_mut_lamports()? -= sol_out;
    **user_account_info.try_borrow_mut_lamports()? += sol_out;

    vault.total_shares = vault.total_shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;
    vault.nav = vault.nav
        .checked_sub(sol_out)
        .ok_or(FornexError::MathOverflow)?;

    user_deposit.shares = user_deposit.shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "Withdraw: {} shares burned → {} lamports returned to {}",
        shares_to_burn, sol_out, ctx.accounts.user.key()
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
