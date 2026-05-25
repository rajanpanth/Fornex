use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::{NavRecord, Vault};

pub fn handler(ctx: Context<RecordNavSnapshot>) -> Result<()> {
    let record = &mut ctx.accounts.nav_record;
    let vault = &mut ctx.accounts.vault;

    record.vault = vault.key();
    record.nav = vault.nav;
    record.timestamp = Clock::get()?.unix_timestamp;
    record.record_index = vault.nav_record_count;
    record.trade_count = vault.trade_count as u64;
    record.bump = ctx.bumps.nav_record;

    vault.nav_record_count = vault
        .nav_record_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;

    msg!(
        "NAV snapshot #{} recorded at {} lamports",
        record.record_index,
        record.nav
    );
    Ok(())
}

#[derive(Accounts)]
pub struct RecordNavSnapshot<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = agent,
        space = 8 + NavRecord::INIT_SPACE,
        seeds = [
            b"nav_record",
            vault.key().as_ref(),
            &vault.nav_record_count.to_le_bytes(),
        ],
        bump
    )]
    pub nav_record: Account<'info, NavRecord>,

    #[account(
        mut,
        constraint = agent.key() == vault.agent_authority @ FornexError::UnauthorizedAgent
    )]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
