#![allow(ambiguous_glob_reexports)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
pub use anchor_spl::associated_token::AssociatedToken;
pub use anchor_spl::token::{
    self, Burn, Mint, MintTo, Token, TokenAccount, Transfer as TokenTransfer,
};

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::AgentVoteInput;

declare_id!("H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf");

#[program]
pub mod fornex {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, agent_authority: Pubkey) -> Result<()> {
        instructions::initialize_vault::handler(ctx, agent_authority)
    }

    pub fn initialize_vault_with_mint(
        ctx: Context<InitializeVaultWithMint>,
        agent_authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize_vault::handler_with_mint(ctx, agent_authority)
    }

    pub fn initialize_vault_mint(ctx: Context<InitializeVaultMint>) -> Result<()> {
        instructions::initialize_vault::handler_mint_for_existing_vault(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, shares_to_burn)
    }

    pub fn log_trade(
        ctx: Context<LogTrade>,
        market: [u8; 16],
        direction: u8,
        size_usd: u64,
        leverage: u8,
        confidence: u8,
        reasoning: [u8; 512],
    ) -> Result<()> {
        instructions::log_trade::handler(
            ctx, market, direction, size_usd, leverage, confidence, reasoning,
        )
    }

    pub fn log_multi_agent_decision(
        ctx: Context<LogMultiAgentDecision>,
        market: String,
        bull_vote: AgentVoteInput,
        bear_vote: AgentVoteInput,
        zen_vote: AgentVoteInput,
        consensus: AgentVoteInput,
        size_usd: u64,
        executed: bool,
        execution_ref: String,
    ) -> Result<()> {
        instructions::log_multi_agent_decision::handler(
            ctx,
            market,
            bull_vote,
            bear_vote,
            zen_vote,
            consensus,
            size_usd,
            executed,
            execution_ref,
        )
    }

    pub fn update_nav(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
        instructions::update_nav::handler(ctx, new_nav)
    }

    pub fn migrate_vault_v2(ctx: Context<MigrateVaultV2>) -> Result<()> {
        instructions::migrate_vault_v2::handler(ctx)
    }

    pub fn record_nav_snapshot(ctx: Context<RecordNavSnapshot>) -> Result<()> {
        instructions::record_nav_snapshot::handler(ctx)
    }

    pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
        instructions::emergency_pause::pause(ctx)
    }

    pub fn resume(ctx: Context<EmergencyPause>) -> Result<()> {
        instructions::emergency_pause::resume(ctx)
    }
}
