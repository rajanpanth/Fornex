use anchor_lang::prelude::*;
use anchor_lang::{system_program, Discriminator};

use crate::errors::FornexError;
use crate::state::Vault;

const ADMIN_OFFSET: usize = 8 + 32;

pub fn handler(ctx: Context<MigrateVaultV2>) -> Result<()> {
    let vault_info = ctx.accounts.vault.to_account_info();
    require_keys_eq!(*vault_info.owner, crate::ID, FornexError::UnauthorizedAdmin);

    let current_len = vault_info.data_len();
    let target_len = 8 + Vault::INIT_SPACE;
    if current_len >= target_len {
        msg!("Vault already migrated to {} bytes", current_len);
        return Ok(());
    }

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
    msg!("Vault migrated from {} to {} bytes", current_len, target_len);
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
