use crate::errors::FornexError;
use crate::state::{UserDeposit, Vault};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

pub fn handler(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
    require!(shares_to_burn > 0, FornexError::InsufficientShares);

    // Validate shares before any mutable borrows
    require!(
        ctx.accounts.user_deposit.shares >= shares_to_burn,
        FornexError::InsufficientShares
    );

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent = Rent::get()?;
    let rent_exempt_reserve = rent.minimum_balance(vault_info.data_len());
    let spendable_lamports = vault_info
        .lamports()
        .checked_sub(rent_exempt_reserve)
        .ok_or(FornexError::InsufficientVaultBalance)?;

    // Read vault state values before mutable borrows. If off-chain NAV is ahead
    // of actual SOL custody, redeem against real spendable lamports.
    let nav = ctx.accounts.vault.nav.min(spendable_lamports);
    let total_shares = ctx.accounts.vault.total_shares;
    let user_key = ctx.accounts.user.key();

    let sol_out = (shares_to_burn as u128)
        .checked_mul(nav as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(total_shares as u128)
        .ok_or(FornexError::MathOverflow)? as u64;

    require!(sol_out > 0, FornexError::InsufficientVaultBalance);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.vault_mint.to_account_info(),
                from: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        shares_to_burn,
    )?;

    // Transfer lamports from vault PDA → user via AccountInfo manipulation
    // Must be done before any Anchor mutable borrow on vault
    let user_info = ctx.accounts.user.to_account_info();
    **vault_info.try_borrow_mut_lamports()? = vault_info
        .lamports()
        .checked_sub(sol_out)
        .ok_or(FornexError::InsufficientVaultBalance)?;
    **user_info.try_borrow_mut_lamports()? = user_info
        .lamports()
        .checked_add(sol_out)
        .ok_or(FornexError::MathOverflow)?;

    // Now update Anchor account state (mutable borrows)
    ctx.accounts.vault.total_shares = ctx
        .accounts
        .vault
        .total_shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;
    ctx.accounts.vault.nav = nav.checked_sub(sol_out).ok_or(FornexError::MathOverflow)?;
    ctx.accounts.user_deposit.shares = ctx
        .accounts
        .user_deposit
        .shares
        .checked_sub(shares_to_burn)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "Withdraw: {} shares burned → {} lamports returned to {}",
        shares_to_burn,
        sol_out,
        user_key
    );

    emit!(WithdrawEvent {
        user: user_key,
        shares_burned: shares_to_burn,
        sol_returned: sol_out,
        new_vault_nav: ctx.accounts.vault.nav,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub shares_burned: u64,
    pub sol_returned: u64,
    pub new_vault_nav: u64,
    pub timestamp: i64,
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
        seeds = [b"vault_mint", vault.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = vault
    )]
    pub vault_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = vault_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"user_deposit", vault.key().as_ref(), user.key().as_ref()],
        bump = user_deposit.bump,
        constraint = user_deposit.owner == user.key()
    )]
    pub user_deposit: Account<'info, UserDeposit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
