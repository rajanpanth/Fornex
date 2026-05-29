use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::{AgentReputation, Vault};

/// Direction encoding (matches `AgentVote.direction` everywhere else):
///   0 = FLAT, 1 = LONG, 2 = SHORT.
const DIRECTION_FLAT: u8 = 0;
const DIRECTION_LONG: u8 = 1;
const DIRECTION_SHORT: u8 = 2;

/// Update per-agent reputation after a trade settles.
///
/// `pnl_lamports` is the realized PnL of the just-closed trade. Each
/// persona's `*_total` increments only when its vote was directional
/// (LONG or SHORT) — FLAT votes are not credited or penalised because
/// they made no directional call.
///
/// A vote is "correct" when:
///   - `direction == LONG`  AND `pnl_lamports > 0`
///   - `direction == SHORT` AND `pnl_lamports < 0` (price moved down vs entry)
///
/// PnL == 0 is treated as a non-event: total counters still increment,
/// but no persona is credited. This keeps the win-rate honest on
/// dust-sized round trips.
///
/// Counters are bounded by `vault.executed_trade_count` to prevent the
/// agent key (if compromised) from inflating its own reputation past the
/// number of actual trades.
pub fn handler(
    ctx: Context<UpdateAgentReputation>,
    bull_direction: u8,
    bear_direction: u8,
    zen_direction: u8,
    pnl_lamports: i64,
) -> Result<()> {
    require!(
        bull_direction <= DIRECTION_SHORT
            && bear_direction <= DIRECTION_SHORT
            && zen_direction <= DIRECTION_SHORT,
        FornexError::InvalidDirection,
    );

    let vault = &ctx.accounts.vault;
    let rep = &mut ctx.accounts.agent_reputation;

    let (bull_dc, bull_dt) = scored(bull_direction, pnl_lamports);
    let (bear_dc, bear_dt) = scored(bear_direction, pnl_lamports);
    let (zen_dc, zen_dt) = scored(zen_direction, pnl_lamports);

    rep.bull_total = rep.bull_total.checked_add(bull_dt).ok_or(FornexError::MathOverflow)?;
    rep.bull_correct = rep.bull_correct.checked_add(bull_dc).ok_or(FornexError::MathOverflow)?;
    rep.bear_total = rep.bear_total.checked_add(bear_dt).ok_or(FornexError::MathOverflow)?;
    rep.bear_correct = rep.bear_correct.checked_add(bear_dc).ok_or(FornexError::MathOverflow)?;
    rep.zen_total = rep.zen_total.checked_add(zen_dt).ok_or(FornexError::MathOverflow)?;
    rep.zen_correct = rep.zen_correct.checked_add(zen_dc).ok_or(FornexError::MathOverflow)?;

    // Hard ceiling: no persona's total can exceed the number of actually
    // executed trades. Defends against double-call and replay.
    let executed = vault.executed_trade_count;
    require!(
        rep.bull_total <= executed
            && rep.bear_total <= executed
            && rep.zen_total <= executed,
        FornexError::ReputationOverflow,
    );

    rep.last_updated = Clock::get()?.unix_timestamp;

    emit!(AgentReputationUpdated {
        bull_correct: rep.bull_correct,
        bull_total: rep.bull_total,
        bear_correct: rep.bear_correct,
        bear_total: rep.bear_total,
        zen_correct: rep.zen_correct,
        zen_total: rep.zen_total,
        pnl_lamports,
        timestamp: rep.last_updated,
    });

    msg!(
        "Reputation updated: BULL {}/{} | BEAR {}/{} | ZEN {}/{} (pnl {})",
        rep.bull_correct,
        rep.bull_total,
        rep.bear_correct,
        rep.bear_total,
        rep.zen_correct,
        rep.zen_total,
        pnl_lamports,
    );
    Ok(())
}

/// Returns `(delta_correct, delta_total)` for one persona.
///
/// FLAT votes return (0, 0): no directional call, no credit, no penalty.
/// LONG with positive PnL or SHORT with negative PnL → correct.
fn scored(direction: u8, pnl_lamports: i64) -> (u32, u32) {
    if direction == DIRECTION_FLAT {
        return (0, 0);
    }
    let was_correct = match direction {
        DIRECTION_LONG => pnl_lamports > 0,
        DIRECTION_SHORT => pnl_lamports < 0,
        _ => false,
    };
    (if was_correct { 1 } else { 0 }, 1)
}

#[event]
pub struct AgentReputationUpdated {
    pub bull_correct: u32,
    pub bull_total: u32,
    pub bear_correct: u32,
    pub bear_total: u32,
    pub zen_correct: u32,
    pub zen_total: u32,
    pub pnl_lamports: i64,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct UpdateAgentReputation<'info> {
    #[account(
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"agent_reputation", vault.key().as_ref()],
        bump = agent_reputation.bump,
        constraint = agent_reputation.vault == vault.key() @ FornexError::UnauthorizedAgent,
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    #[account(mut)]
    pub agent: Signer<'info>,
}
