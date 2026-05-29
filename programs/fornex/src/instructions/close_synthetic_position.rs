use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::errors::FornexError;
use crate::state::{SyntheticPosition, Vault};

const SOL_USD_FEED_ID: &str =
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/// Close an open synthetic perpetual position by stamping the Pyth close
/// price and computing realized PnL. Increments executed_trade_count and,
/// on positive PnL, winning_trades. Bounded to ±50% of NAV per close.
///
/// Agent-only. Returns realized PnL in lamports.
pub fn handler(ctx: Context<CloseSyntheticPosition>) -> Result<()> {
    require!(
        !ctx.accounts.vault.is_trading_paused,
        FornexError::TradingPaused
    );

    let position = &mut ctx.accounts.position;
    require!(position.is_open, FornexError::PositionAlreadyClosed);

    let clock = Clock::get()?;
    let price = ctx
        .accounts
        .price_update
        .get_price_no_older_than(&clock, 60, &get_feed_id_from_hex(SOL_USD_FEED_ID)?)
        .map_err(|_| FornexError::PythPriceUnavailable)?;
    let close_price: u64 = price.price.max(0) as u64;
    require!(close_price > 0, FornexError::PythPriceUnavailable);

    // PnL formula:
    //   gross_pnl_per_unit_collateral = leverage * (close - entry) / entry  (LONG)
    //   gross_pnl_per_unit_collateral = leverage * (entry - close) / entry  (SHORT)
    // Multiplied by collateral_lamports for absolute lamport PnL.
    let entry = position.entry_price as i128;
    let close = close_price as i128;
    let lev = position.leverage as i128;
    let collat = position.collateral_lamports as i128;

    let price_diff = if position.direction == 1 {
        close.checked_sub(entry).ok_or(FornexError::MathOverflow)?
    } else if position.direction == 2 {
        entry.checked_sub(close).ok_or(FornexError::MathOverflow)?
    } else {
        return Err(error!(FornexError::InvalidDirection));
    };

    let pnl_lamports = collat
        .checked_mul(lev)
        .ok_or(FornexError::MathOverflow)?
        .checked_mul(price_diff)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(entry)
        .ok_or(FornexError::MathOverflow)?;
    let pnl_lamports_i64 =
        i64::try_from(pnl_lamports).map_err(|_| FornexError::MathOverflow)?;

    // Bound a single close to ±50% of NAV (mirror record_trade_outcome).
    let nav = ctx.accounts.vault.nav;
    if nav > 0 {
        let cap = (nav / 2) as i128;
        let abs = pnl_lamports.unsigned_abs() as i128;
        require!(abs <= cap, FornexError::PnlOutOfBounds);
    }

    position.close_price = close_price;
    position.closed_at = clock.unix_timestamp;
    position.realized_pnl_lamports = pnl_lamports_i64;
    position.is_open = false;

    // Update vault counters honestly (deposits never count as wins; only
    // closed positions with positive realized PnL bump winning_trades).
    let vault = &mut ctx.accounts.vault;
    vault.executed_trade_count = vault
        .executed_trade_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;
    if pnl_lamports_i64 > 0 {
        vault.winning_trades = vault
            .winning_trades
            .checked_add(1)
            .ok_or(FornexError::MathOverflow)?;
    }

    emit!(SyntheticPositionClosedEvent {
        vault: position.vault,
        position_index: position.position_index,
        entry_price: position.entry_price,
        close_price,
        pnl_lamports: pnl_lamports_i64,
        executed_trade_count: vault.executed_trade_count,
        winning_trades: vault.winning_trades,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Synthetic position #{} closed: entry={} close={} pnl_lamports={} (wins {}/{})",
        position.position_index,
        position.entry_price,
        close_price,
        pnl_lamports_i64,
        vault.winning_trades,
        vault.executed_trade_count
    );
    Ok(())
}

#[event]
pub struct SyntheticPositionClosedEvent {
    pub vault: Pubkey,
    pub position_index: u32,
    pub entry_price: u64,
    pub close_price: u64,
    pub pnl_lamports: i64,
    pub executed_trade_count: u32,
    pub winning_trades: u32,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct CloseSyntheticPosition<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [
            b"synthetic_position",
            vault.key().as_ref(),
            &position.position_index.to_le_bytes(),
        ],
        bump = position.bump,
        constraint = position.vault == vault.key()
    )]
    pub position: Account<'info, SyntheticPosition>,

    pub price_update: Account<'info, PriceUpdateV2>,

    #[account(mut)]
    pub agent: Signer<'info>,
}
