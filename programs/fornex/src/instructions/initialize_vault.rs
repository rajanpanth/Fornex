use anchor_lang::prelude::*;
use crate::state::Vault;

/// Creates the Fornex vault. Called once during setup.
/// The agent_authority is the AI agent's wallet that will execute trades.
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
    vault.created_at = clock.unix_timestamp;
    vault.bump = ctx.bumps.vault;

    msg!("Fornex vault initialized. Agent: {}", agent_authority);
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
