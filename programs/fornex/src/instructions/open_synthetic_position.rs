use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::errors::FornexError;
use crate::state::{SyntheticPosition, Vault};

const SOL_USD_FEED_ID: &str =
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/// Open a synthetic perpetual position.
///
/// The position is fully on-chain, Pyth-price-stamped, and sized in lamports
/// (the collateral the agent commits) plus a USD notional. PnL settles via
/// close_synthetic_position which calls record_trade_outcome.
///
/// Agent-only. Direction must be LONG (1) or SHORT (2). Leverage 1..=3.
/// Collateral is bounded to ≤ 50% of NAV so a single position cannot blow
/// up the vault even if mispriced.
pub fn handler(
    ctx: Context<OpenSyntheticPosition>,
    direction: u8,
    leverage: u8,
    collateral_lamports: u64,
) -> Result<()> {
    require!(
        direction == 1 || direction == 2,
        FornexError::InvalidDirection
    );
    require!(
        leverage >= 1 && leverage <= 3,
        FornexError::LeverageOverCap
    );
    require!(
        !ctx.accounts.vault.is_trading_paused,
        FornexError::TradingPaused
    );

    let nav = ctx.accounts.vault.nav;
    if nav > 0 {
        let cap = nav.checked_div(2).ok_or(FornexError::MathOverflow)?;
        require!(
            collateral_lamports > 0 && collateral_lamports <= cap,
            FornexError::SyntheticSizeOutOfBounds
        );
    }

    let clock = Clock::get()?;
    let price = ctx
        .accounts
        .price_update
        .get_price_no_older_than(&clock, 60, &get_feed_id_from_hex(SOL_USD_FEED_ID)?)
        .map_err(|_| FornexError::PythPriceUnavailable)?;
    let entry_price: u64 = price.price.max(0) as u64;
    require!(entry_price > 0, FornexError::PythPriceUnavailable);

    // size_usd = collateral (SOL) * leverage * SOL_USD_price
    // Pyth Lazer price has exponent -8 → divide by 1e8 to get USD-cents-ish.
    // We store size_usd in 1e6 precision (USDC-ish) for downstream tooling.
    let size_usd: u64 = (collateral_lamports as u128)
        .checked_mul(leverage as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_mul(entry_price as u128)
        .ok_or(FornexError::MathOverflow)?
        .checked_div(1_000_000_000_u128) // lamports → SOL
        .ok_or(FornexError::MathOverflow)?
        .checked_div(100_u128)            // 1e8 / 1e6 = 1e2
        .ok_or(FornexError::MathOverflow)? as u64;

    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let position = &mut ctx.accounts.position;

    let position_index = vault
        .synthetic_position_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;
    vault.synthetic_position_count = position_index;

    position.vault = vault_key;
    position.position_index = position_index;
    position.direction = direction;
    position.leverage = leverage;
    position.entry_price = entry_price;
    position.close_price = 0;
    position.collateral_lamports = collateral_lamports;
    position.size_usd = size_usd;
    position.opened_at = clock.unix_timestamp;
    position.closed_at = 0;
    position.realized_pnl_lamports = 0;
    position.is_open = true;
    position.bump = ctx.bumps.position;

    emit!(SyntheticPositionOpenedEvent {
        vault: vault_key,
        position_index,
        direction,
        leverage,
        entry_price,
        collateral_lamports,
        size_usd,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Synthetic position #{} opened: dir={} lev={}x collateral={} entry={} ({})",
        position_index,
        direction,
        leverage,
        collateral_lamports,
        entry_price,
        if direction == 1 { "LONG" } else { "SHORT" }
    );
    Ok(())
}

#[event]
pub struct SyntheticPositionOpenedEvent {
    pub vault: Pubkey,
    pub position_index: u32,
    pub direction: u8,
    pub leverage: u8,
    pub entry_price: u64,
    pub collateral_lamports: u64,
    pub size_usd: u64,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct OpenSyntheticPosition<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.agent_authority == agent.key() @ FornexError::UnauthorizedAgent
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = agent,
        space = 8 + SyntheticPosition::INIT_SPACE,
        seeds = [
            b"synthetic_position",
            vault.key().as_ref(),
            &(vault.synthetic_position_count + 1).to_le_bytes(),
        ],
        bump
    )]
    pub position: Account<'info, SyntheticPosition>,

    pub price_update: Account<'info, PriceUpdateV2>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
