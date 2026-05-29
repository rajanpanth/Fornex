use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::{AgentReputation, Vault};

/// One-time initializer for the per-agent reputation PDA.
///
/// Called by the vault admin after the program is upgraded to v0.4.
/// All counters start at zero and `last_updated` is stamped with the
/// current Unix timestamp so the dashboard can show a meaningful age.
///
/// PDA seeds: ["agent_reputation", vault.key()].
pub fn handler(ctx: Context<InitAgentReputation>) -> Result<()> {
    let rep = &mut ctx.accounts.agent_reputation;

    rep.vault = ctx.accounts.vault.key();
    rep.bull_correct = 0;
    rep.bull_total = 0;
    rep.bear_correct = 0;
    rep.bear_total = 0;
    rep.zen_correct = 0;
    rep.zen_total = 0;
    rep.last_updated = Clock::get()?.unix_timestamp;
    rep.bump = ctx.bumps.agent_reputation;

    msg!(
        "AgentReputation initialized for vault {}",
        ctx.accounts.vault.key()
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitAgentReputation<'info> {
    #[account(
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.admin == admin.key() @ FornexError::UnauthorizedAdmin,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + AgentReputation::INIT_SPACE,
        seeds = [b"agent_reputation", vault.key().as_ref()],
        bump,
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
