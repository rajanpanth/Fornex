use anchor_lang::prelude::*;
use crate::state::{Vault, TradeLog};
use crate::errors::FornexError;

pub fn handler(
    ctx: Context<LogTrade>,
    market: [u8; 16],
    direction: u8,
    size_usd: u64,
    leverage: u8,
    confidence: u8,
    reasoning: [u8; 512],
) -> Result<()> {
    require!(direction <= 3, FornexError::InvalidDirection);
    require!(leverage >= 1 && leverage <= 10, FornexError::InvalidLeverage);
    require!(confidence <= 100, FornexError::InvalidConfidence);
    require!(
        !ctx.accounts.vault.is_trading_paused,
        FornexError::TradingPaused
    );

    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let trade_log = &mut ctx.accounts.trade_log;
    let clock = Clock::get()?;

    vault.trade_count = vault.trade_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;

    trade_log.vault = vault_key;
    trade_log.trade_index = vault.trade_count;
    trade_log.market = market;
    trade_log.direction = direction;
    trade_log.size_usd = size_usd;
    trade_log.leverage = leverage;
    trade_log.confidence = confidence;
    trade_log.reasoning = reasoning;
    trade_log.pnl_lamports = 0;
    trade_log.timestamp = clock.unix_timestamp;
    trade_log.bump = ctx.bumps.trade_log;

    let dir_label = match direction {
        1 => "LONG",
        2 => "SHORT",
        3 => "CLOSE",
        _ => "FLAT",
    };

    msg!(
        "Trade #{}: {} {} | {}x | Confidence: {}% | {}",
        vault.trade_count,
        dir_label,
        display_bytes(&trade_log.market),
        leverage,
        confidence,
        display_bytes(&trade_log.reasoning)
    );

    Ok(())
}

fn display_bytes(bytes: &[u8]) -> String {
    let len = bytes.iter().position(|byte| *byte == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..len]).to_string()
}

#[derive(Accounts)]
pub struct LogTrade<'info> {
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
        space = 8 + TradeLog::INIT_SPACE,
        seeds = [
            b"trade_log",
            vault.key().as_ref(),
            &(vault.trade_count + 1).to_le_bytes()
        ],
        bump
    )]
    pub trade_log: Account<'info, TradeLog>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
