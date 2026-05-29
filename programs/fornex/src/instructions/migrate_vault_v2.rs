use anchor_lang::prelude::*;
use anchor_lang::{system_program, Discriminator};

use crate::errors::FornexError;
use crate::state::Vault;

const ADMIN_OFFSET: usize = 8 + 32;
// Vault field offsets (after 8-byte discriminator):
//   agent_authority Pubkey (32) | admin Pubkey (32) | total_deposits u64 (8)
//   total_shares u64 (8) | nav u64 (8) | trade_count u32 (4)
//   winning_trades u32 (4) | is_trading_paused bool (1) | created_at i64 (8)
//   bump u8 (1) | nav_record_count u64 (8) | executed_trade_count u32 (4)
//   inception_nav u64 (8)
const NAV_OFFSET: usize = 8 + 32 + 32 + 8 + 8;
const INCEPTION_NAV_OFFSET: usize = 8 + 32 + 32 + 8 + 8 + 8 + 4 + 4 + 1 + 8 + 1 + 8 + 4;

pub fn handler(ctx: Context<MigrateVaultV2>) -> Result<()> {
    let vault_info = ctx.accounts.vault.to_account_info();
    require_keys_eq!(*vault_info.owner, crate::ID, FornexError::UnauthorizedAdmin);

    let current_len = vault_info.data_len();
    let target_len = 8 + Vault::INIT_SPACE;

    {
        let data = vault_info.try_borrow_data()?;
        require!(
            data.len() >= ADMIN_OFFSET + 32,
            FornexError::InsufficientVaultBalance
        );
        require!(
            data[0..8] == Vault::DISCRIMINATOR,
            FornexError::UnauthorizedAdmin
        );
        let admin = Pubkey::new_from_array(data[ADMIN_OFFSET..ADMIN_OFFSET + 32].try_into().unwrap());
        require_keys_eq!(admin, ctx.accounts.admin.key(), FornexError::UnauthorizedAdmin);
    }

    if current_len < target_len {
        let rent = Rent::get()?;
        let required_lamports = rent.minimum_balance(target_len);
        let current_lamports = vault_info.lamports();
        if required_lamports > current_lamports {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.admin.to_account_info(),
                        to: vault_info.clone(),
                    },
                ),
                required_lamports - current_lamports,
            )?;
        }
        vault_info.realloc(target_len, true)?;
        msg!("Vault reallocated from {} to {} bytes", current_len, target_len);
    } else {
        msg!("Vault already at {} bytes", current_len);
    }

    // Backfill inception_nav for vaults that pre-date the field. The field is
    // zero after realloc; if it's still zero and nav is non-zero, stamp it.
    {
        let data = vault_info.try_borrow_data()?;
        let nav = u64::from_le_bytes(data[NAV_OFFSET..NAV_OFFSET + 8].try_into().unwrap());
        let inception = u64::from_le_bytes(
            data[INCEPTION_NAV_OFFSET..INCEPTION_NAV_OFFSET + 8].try_into().unwrap(),
        );
        drop(data);
        if inception == 0 && nav > 0 {
            let mut data = vault_info.try_borrow_mut_data()?;
            data[INCEPTION_NAV_OFFSET..INCEPTION_NAV_OFFSET + 8]
                .copy_from_slice(&nav.to_le_bytes());
            msg!("inception_nav backfilled to {}", nav);
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct MigrateVaultV2<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    /// CHECK: This instruction reads and reallocs the legacy vault layout before
    /// the new Vault account can be deserialized safely.
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}
