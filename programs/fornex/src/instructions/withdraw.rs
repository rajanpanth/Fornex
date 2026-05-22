use anchor_lang::prelude::*;
use crate::state::{Vault, UserDeposit};
use crate::errors::FornexError;

/// User burns shares and withdraws proportional SOL from the vault.
///
/// Calculation:
///   sol_out = (shares_to_burn / total_shares) * vault_nav
///
/// Example: vault NAV is 12 SOL, total 12 shares. You have 3 shares.
///   → You burn 3 shares → get (3/12) * 12 = 3 SOL
///   → If vault grew to 15 SOL NAV: (3/12) * 15 = 3.75 SOL (profit!)
pub fn handler(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, FornexError::InsufficientShares);

    let user_deposit = &mut ctx.accounts.user_deposit;
    require!(
        user_deposit.shares >= shares_to_burn,
        FornexError::InsufficientShares
    );

    let vault = &mut ctx.accounts.vault;

    // Calculate SOL to return based on current NAV
    let sol_out = (shares_to_burn as u128)
        .checked_mul(vault.nav as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(vault.total_shares as u128)
        .ok_or(FornexError::MathOverflow)? as u64;

    require!(sol_out > 0, FornexError::InsufficientVaultBalance);

    // Transfer SOL from vault PDA to user
    // Since vault is a PDA, we need to use the vault seeds to sign
    let vault_bump = vault.bump;
    let vault_seeds: &[&[&[u8]]] = &[&[b"vault", &[vault_bump]]];

    let vault_account_info = vault.to_account_info();
    let user_account_info = ctx.accounts.user.to_account_info();

    // Decrease vault lamports and increase user lamports
    **vault_account_info.try_borrow_mut_lamports()? -= sol_out;
    **user_account_info.try_borrow_mut_lamports()? += sol_out;

    // Update vault state
    vault.total_shares = vault.total_shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;
    vault.nav = vault.nav
        .checked_sub(sol_out)
        .ok_or(FornexError::MathOverflow)?;

    // Update user deposit
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
