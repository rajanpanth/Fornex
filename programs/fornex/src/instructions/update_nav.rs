use anchor_lang::prelude::*;
use crate::state::Vault;
use crate::errors::FornexError;

/// Agent updates the vault's Net Asset Value after trades settle.
/// This is what changes share prices for all depositors.
///
/// Example flow:
///   1. Vault NAV = 10 SOL, 10 shares → share price = 1 SOL
///   2. Agent opens a LONG, SOL pumps 5%
///   3. Agent closes trade, vault now has 10.5 SOL in value
///   4. Agent calls update_nav(10.5 SOL)
///   5. Now each share = 1.05 SOL → everyone's deposit grew 5%
///
/// The agent also tracks whether this was a winning trade for the win rate stat.
pub fn handler(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    let old_nav = vault.nav;

    // If NAV increased, count it as a winning trade
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
        // Only the AI agent can update NAV
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub agent: Signer<'info>,
}
