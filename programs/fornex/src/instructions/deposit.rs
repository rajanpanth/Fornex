use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Vault, UserDeposit};
use crate::errors::FornexError;

/// User deposits SOL into the vault and receives proportional shares.
///
/// Share calculation:
///   - First depositor: shares = deposit amount (1:1)
///   - Subsequent: shares = (deposit * total_shares) / vault_nav
///
/// Example: vault has 10 SOL NAV, 10 shares. You deposit 2 SOL.
///   → You get (2 * 10) / 10 = 2 shares
///   → Now vault has 12 SOL, 12 shares. Your 2 shares = 16.67% of vault.
pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, FornexError::ZeroDeposit);

    let vault = &mut ctx.accounts.vault;
    let user_deposit = &mut ctx.accounts.user_deposit;
    let clock = Clock::get()?;

    // Calculate shares to mint for this deposit
    let shares_to_mint = if vault.total_shares == 0 {
        // First depositor gets 1:1 shares
        amount
    } else {
        // Proportional shares based on current NAV
        (amount as u128)
            .checked_mul(vault.total_shares as u128)
            .ok_or(FornexError::MathOverflow)?
            .checked_div(vault.nav as u128)
            .ok_or(FornexError::ZeroNav)? as u64
    };

    // Transfer SOL from user to vault PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update vault state
    vault.total_deposits = vault.total_deposits
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;
    vault.total_shares = vault.total_shares
        .checked_add(shares_to_mint)
        .ok_or(FornexError::MathOverflow)?;
    vault.nav = vault.nav
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;

    // Update user deposit record
    if user_deposit.deposited_at == 0 {
        // First time depositing
        user_deposit.owner = ctx.accounts.user.key();
        user_deposit.vault = ctx.accounts.vault.key();
        user_deposit.deposited_at = clock.unix_timestamp;
        user_deposit.bump = ctx.bumps.user_deposit;
    }
    user_deposit.shares = user_deposit.shares
        .checked_add(shares_to_mint)
        .ok_or(FornexError::MathOverflow)?;
    user_deposit.total_deposited = user_deposit.total_deposited
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "Deposit: {} lamports → {} shares minted for {}",
        amount, shares_to_mint, ctx.accounts.user.key()
    );

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserDeposit::INIT_SPACE,
        seeds = [b"user_deposit", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}
