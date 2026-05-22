use anchor_lang::prelude::*;

use crate::errors::FornexError;
use crate::state::{AgentVote, AgentVoteInput, MultiAgentDecision, Vault};

pub fn handler(
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
    require!(market.len() <= 16, FornexError::MarketNameTooLong);
    validate_vote(&bull_vote)?;
    validate_vote(&bear_vote)?;
    validate_vote(&zen_vote)?;
    validate_vote(&consensus)?;
    require!(execution_ref.len() <= 88, FornexError::ExecutionRefTooLong);

    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let decision = &mut ctx.accounts.decision;
    let clock = Clock::get()?;

    vault.trade_count = vault
        .trade_count
        .checked_add(1)
        .ok_or(FornexError::MathOverflow)?;

    decision.vault = vault_key;
    decision.decision_index = vault.trade_count;
    decision.market = fixed_bytes::<16>(&market);
    decision.bull_vote = fixed_vote(&bull_vote);
    decision.bear_vote = fixed_vote(&bear_vote);
    decision.zen_vote = fixed_vote(&zen_vote);
    decision.consensus = fixed_vote(&consensus);
    decision.size_usd = size_usd;
    decision.executed = executed;
    decision.execution_ref = fixed_bytes::<88>(&execution_ref);
    decision.pnl_lamports = 0;
    decision.timestamp = clock.unix_timestamp;
    decision.bump = ctx.bumps.decision;

    emit!(MultiAgentDecisionEvent {
        vault: decision.vault,
        decision_index: decision.decision_index,
        market: decision.market,
        consensus_direction: decision.consensus.direction,
        consensus_leverage: decision.consensus.leverage,
        consensus_confidence: decision.consensus.confidence,
        executed,
        timestamp: decision.timestamp,
    });

    msg!(
        "Multi-agent decision #{}: {} direction={} leverage={} confidence={} executed={}",
        decision.decision_index,
        display_bytes(&decision.market),
        decision.consensus.direction,
        decision.consensus.leverage,
        decision.consensus.confidence,
        decision.executed
    );

    Ok(())
}

fn validate_vote(vote: &AgentVoteInput) -> Result<()> {
    require!(vote.direction <= 3, FornexError::InvalidDirection);
    require!(
        vote.leverage >= 1 && vote.leverage <= 10,
        FornexError::InvalidLeverage
    );
    require!(vote.confidence <= 100, FornexError::InvalidConfidence);
    require!(
        vote.reasoning.len() <= 200,
        FornexError::AgentReasoningTooLong
    );

    Ok(())
}

fn fixed_vote(vote: &AgentVoteInput) -> AgentVote {
    AgentVote {
        direction: vote.direction,
        leverage: vote.leverage,
        confidence: vote.confidence,
        reasoning: fixed_bytes::<200>(&vote.reasoning),
    }
}

fn fixed_bytes<const N: usize>(value: &str) -> [u8; N] {
    let mut output = [0u8; N];
    let bytes = value.as_bytes();
    let len = bytes.len().min(N);
    output[..len].copy_from_slice(&bytes[..len]);
    output
}

fn display_bytes(bytes: &[u8]) -> String {
    let len = bytes.iter().position(|byte| *byte == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..len]).to_string()
}

#[event]
pub struct MultiAgentDecisionEvent {
    pub vault: Pubkey,
    pub decision_index: u32,
    pub market: [u8; 16],
    pub consensus_direction: u8,
    pub consensus_leverage: u8,
    pub consensus_confidence: u8,
    pub executed: bool,
    pub timestamp: i64,
}

#[derive(Accounts)]
pub struct LogMultiAgentDecision<'info> {
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
        space = 8 + MultiAgentDecision::INIT_SPACE,
        seeds = [
            b"trade_log",
            vault.key().as_ref(),
            &(vault.trade_count + 1).to_le_bytes()
        ],
        bump
    )]
    pub decision: Account<'info, MultiAgentDecision>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
