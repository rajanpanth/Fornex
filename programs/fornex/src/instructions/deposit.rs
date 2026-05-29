use crate::errors::FornexError;
use crate::state::{UserDeposit, Vault};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, FornexError::ZeroDeposit);

    let clock = Clock::get()?;

    let shares_to_mint = if ctx.accounts.vault.total_shares == 0 {
        amount
    } else {
        (amount as u128)
            .checked_mul(ctx.accounts.vault.total_shares as u128)
            .ok_or(FornexError::MathOverflow)?
            .checked_div(ctx.accounts.vault.nav as u128)
            .ok_or(FornexError::ZeroNav)? as u64
    };
    require!(shares_to_mint > 0, FornexError::ZeroShares);

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

    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", &[ctx.accounts.vault.bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.vault_mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        shares_to_mint,
    )?;

    let vault = &mut ctx.accounts.vault;
    let user_deposit = &mut ctx.accounts.user_deposit;

    vault.total_deposits = vault
        .total_deposits
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;
    vault.total_shares = vault
        .total_shares
        .checked_add(shares_to_mint)
        .ok_or(FornexError::MathOverflow)?;
    vault.nav = vault
        .nav
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;

    // Stamp inception NAV on the first deposit so the dashboard can compute
    // a verifiable since-inception change instead of using a hardcoded baseline.
    if vault.inception_nav == 0 {
        vault.inception_nav = vault.nav;
    }

    if user_deposit.deposited_at == 0 {
        user_deposit.owner = ctx.accounts.user.key();
        user_deposit.vault = ctx.accounts.vault.key();
        user_deposit.deposited_at = clock.unix_timestamp;
        user_deposit.bump = ctx.bumps.user_deposit;
    }
    user_deposit.shares = user_deposit
        .shares
        .checked_add(shares_to_mint)
        .ok_or(FornexError::MathOverflow)?;
    user_deposit.total_deposited = user_deposit
        .total_deposited
        .checked_add(amount)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "Deposit: {} lamports → {} shares minted for {}",
        amount,
        shares_to_mint,
        ctx.accounts.user.key()
    );

    emit!(DepositEvent {
        user: ctx.accounts.user.key(),
        amount_lamports: amount,
        shares_minted: shares_to_mint,
        new_vault_nav: ctx.accounts.vault.nav,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub amount_lamports: u64,
    pub shares_minted: u64,
    pub new_vault_nav: u64,
    pub timestamp: i64,
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
        mut,
        seeds = [b"vault_mint", vault.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = vault
    )]
    pub vault_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = vault_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

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

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
