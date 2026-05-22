use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod fornex {
    use super::*;

    /// Creates the vault. Only called once by the deployer.
    /// Sets the AI agent's wallet as the vault authority.
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        agent_authority: Pubkey,
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, agent_authority)
    }

    /// User deposits SOL into the vault and receives proportional shares.
    /// First depositor gets 1:1 shares. Subsequent depositors get:
    ///   shares = (deposit_amount * total_shares) / vault_nav
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// User burns their shares and withdraws proportional SOL.
    ///   sol_out = (user_shares / total_shares) * vault_nav
    pub fn withdraw(ctx: Context<Withdraw>, shares_to_burn: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, shares_to_burn)
    }

    /// Agent logs a trade decision on-chain for full transparency.
    /// Only callable by the vault's agent authority.
    /// This is the "AI reasoning" that shows up in the frontend feed.
    pub fn log_trade(
        ctx: Context<LogTrade>,
        market: String,
        direction: u8,     // 0 = Long, 1 = Short, 2 = Close
        size_usd: u64,
        leverage: u8,
        confidence: u8,    // 0-100
        reasoning: String, // AI's explanation stored permanently on Solana
    ) -> Result<()> {
        instructions::log_trade::handler(
            ctx, market, direction, size_usd, leverage, confidence, reasoning,
        )
    }

    /// Agent updates the vault's Net Asset Value after trades settle.
    /// This is what changes everyone's share price.
    /// Only callable by the vault's agent authority.
    pub fn update_nav(ctx: Context<UpdateNav>, new_nav: u64) -> Result<()> {
        instructions::update_nav::handler(ctx, new_nav)
    }
}
