use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;
use state::AgentVoteInput;

declare_id!("H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf");

#[program]
pub mod fornex {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        agent_authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, agent_authority)
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
}
