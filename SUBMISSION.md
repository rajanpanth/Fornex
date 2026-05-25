# Fornex Protocol — Submission

## One-liner
Autonomous Solana AI trading vault with real SPL vault-share tokens, on-chain AI decisions, oracle-verified pricing, and live blockchain-indexed UX.

## Short Description
Fornex Protocol is a Solana devnet AI trading vault where users deposit devnet SOL and receive real $FNRX SPL vault-share tokens. Deposits mint $FNRX through Token Program CPI, and withdrawals burn $FNRX before returning SOL. A multi-agent AI system (BULL, BEAR, ZEN) debates every trade every 15 minutes; all votes and consensus are written permanently on-chain. The protocol records NAV snapshots as PDA accounts, verifies SOL price data through the Pyth oracle in Rust, and exposes live activity through a Helius webhook/SSE-powered frontend. The result is a transparent autonomous trading protocol demo — not just a UI.

## Live Links

| Resource | Link |
|---|---|
| Live App | https://YOUR-VERCEL-DOMAIN.vercel.app |
| Demo Video | https://YOUR-DEMO-VIDEO-LINK |
| GitHub | https://github.com/YOUR_USERNAME/fornex-protocol |
| Program Explorer | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| Vault PDA Explorer | https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet |
| $FNRX Mint Explorer | https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet |

## Program Addresses

| Account | Address |
|---|---|
| Program ID | `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf` |
| Vault PDA | `HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR` |
| $FNRX Mint | `BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj` |
| Network | Solana Devnet |

## Technical Highlights

- **Real $FNRX SPL vault-share token** — visible in Phantom wallet
- **Token Program CPI mint/burn** — deposit mints, withdraw burns; pure on-chain
- **On-chain NAV ledger** — NavRecord PDA accounts, rebuildable from chain history
- **Pyth SOL/USD oracle verification** — price verified in Rust, stored in MultiAgentDecision
- **Multi-agent BULL/BEAR/ZEN consensus** — 3 Azure GPT-4o agents, 2/3 majority wins
- **Helius webhook + SSE live feed** — real-time blockchain event indexing
- **Strategy Orders panel** — decoded directly from on-chain decision accounts
- **Priority fee selector** — DYNAMIC / FAST / TURBO, resolved at transaction time
- **Pyth/RPC status indicators** — live health check every 30 seconds
- **Live landing page preview** — on-chain decisions, no wallet required
- **PM2 autonomous agent** — 15-minute cycles, boxed console output
- **12 Anchor instructions** — complex on-chain business logic

## Architecture

```
User (Phantom) → deposit SOL → Anchor Vault (Solana Devnet)
                                    ↓
                          $FNRX minted via Token Program CPI
                                    ↓
                          AI Agent (pm2, every 15 min)
                          BULL + BEAR + ZEN debate via GPT-4o
                          Consensus stored on-chain
                          Pyth price verified in Rust
                          NAV snapshot recorded as PDA
                                    ↓
                          Helius webhook → SSE → Frontend
                          Next.js reads chain live
```

## Judge Demo Checklist

- [ ] Landing page loads with live on-chain decisions (no wallet needed)
- [ ] `/app` dashboard loads
- [ ] Phantom devnet wallet connects
- [ ] Deposit devnet SOL → $FNRX minted and shown in balance
- [ ] Withdraw → $FNRX burned, SOL returned
- [ ] Strategy Orders panel visible with latest decision
- [ ] Pyth/RPC status indicators visible and live
- [ ] Vote breakdown (BULL/BEAR/ZEN) visible in decision cards
- [ ] Pyth-verified price shown in decision details
- [ ] Explorer links open correctly on devnet
- [ ] PM2 logs show boxed autonomous agent output

## Demo Proof Transactions (Devnet)

| Action | Transaction |
|---|---|
| Deposit 0.5 SOL | https://solscan.io/tx/4AQNwfbUs1Z3cbo7VLreCeLgrrh1r7PnCzoKQzYQoL97JgQiQw4TWeiHpJsjvy6roAwq9F4BSqdukfsEcBsZRvRj?cluster=devnet |
| Withdraw SOL | https://solscan.io/tx/4bfNiVKpZFKAzYvNmkUbbF2xzPGQKsq8faUqsKMFjbz6VzN2ef1qNFWMZahP3ScHQ7sropae9DfLcj5khVcbtwR1?cluster=devnet |

## Vercel Environment Variables

Set these in Vercel project settings → Environment Variables:

```
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_VAULT_PROGRAM_ID=H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf
NEXT_PUBLIC_VAULT_ADDRESS=HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR
NEXT_PUBLIC_FNRX_MINT=BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj
NEXT_PUBLIC_HELIUS_RPC_URL=  (optional: Helius RPC for higher rate limits)
```

## Helius Webhook Setup

Configure in Helius dashboard:
- **Account Addresses**: `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf`
- **Transaction Types**: `PROGRAM_INTERACTION`
- **Webhook URL**: `https://YOUR-VERCEL-DOMAIN.vercel.app/api/webhook`
- **Webhook Type**: `enhanced`

## Build Notes

```bash
# Frontend
npm install
npm run build    # must pass

# Anchor (requires no spaces in path on Windows)
# Clone to C:\fornex or ~/fornex first on Windows
anchor build
anchor deploy --provider.cluster devnet
```

> ⚠ anchor build fails on Windows paths containing spaces (os error 123 in cargo-build-sbf).
> Clone to a no-space path like `C:\fornex` before building on Windows.

## Safety / Honesty

This is a **Solana devnet hackathon prototype**. It is not audited, not deployed on mainnet, and not intended for real user funds. All transactions use devnet SOL with no real monetary value.
