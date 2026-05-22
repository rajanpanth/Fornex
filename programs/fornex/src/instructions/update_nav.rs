use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::FornexError;

pub fn handler(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    let old_nav = vault.nav;

    if new_nav > old_nav && vault.trade_count > 0 {
        vault.winning_trades = vault.winning_trades
            .checked_add(1)
            .ok_or(FornexError::MathOverflow)?;
    }

    vault.nav = new_nav;

    let change_bps = if old_nav > 0 {
        ((new_nav as i128 - old_nav as i128) * 10000 / old_nav as i128) as i64
    } else {
        0
    };

    msg!(
        "NAV updated: {} → {} lamports ({}bps change)",
        old_nav, new_nav, change_bps
    );

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateNav<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub agent: Signer<'info>,
}
