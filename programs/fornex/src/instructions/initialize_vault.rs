use crate::state::Vault;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

pub fn handler(ctx: Context<InitializeVault>, agent_authority: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.agent_authority = agent_authority;
    vault.admin = ctx.accounts.admin.key();
    vault.total_deposits = 0;
    vault.total_shares = 0;
    vault.nav = 0;
    vault.trade_count = 0;
    vault.winning_trades = 0;
    vault.is_trading_paused = false;
    vault.created_at = clock.unix_timestamp;
    vault.bump = ctx.bumps.vault;
    vault.nav_record_count = 0;
    vault.executed_trade_count = 0;
    vault.inception_nav = 0;
    vault.synthetic_position_count = 0;

    msg!("Fornex vault initialized. Agent: {}", agent_authority);
    Ok(())
}

pub fn handler_with_mint(
    ctx: Context<InitializeVaultWithMint>,
    agent_authority: Pubkey,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.agent_authority = agent_authority;
    vault.admin = ctx.accounts.admin.key();
    vault.total_deposits = 0;
    vault.total_shares = 0;
    vault.nav = 0;
    vault.trade_count = 0;
    vault.winning_trades = 0;
    vault.is_trading_paused = false;
    vault.created_at = clock.unix_timestamp;
    vault.bump = ctx.bumps.vault;
    vault.nav_record_count = 0;
    vault.executed_trade_count = 0;
    vault.inception_nav = 0;
    vault.synthetic_position_count = 0;

    msg!(
        "Fornex vault initialized with $FNRX mint {}. Agent: {}",
        ctx.accounts.vault_mint.key(),
        agent_authority
    );
    Ok(())
}

pub fn handler_mint_for_existing_vault(ctx: Context<InitializeVaultMint>) -> Result<()> {
    msg!(
        "$FNRX mint {} initialized for existing vault {}",
        ctx.accounts.vault_mint.key(),
        ctx.accounts.vault.key()
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVaultWithMint<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        seeds = [b"vault_mint", vault.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = vault,
        mint::freeze_authority = vault
    )]
    pub vault_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeVaultMint<'info> {
    #[account(
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.admin == admin.key()
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        seeds = [b"vault_mint", vault.key().as_ref()],
        bump,
        mint::decimals = 9,
        mint::authority = vault,
        mint::freeze_authority = vault
    )]
    pub vault_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
