# Fornex Protocol — Submission

## One-liner
Autonomous Solana AI trading vault with real SPL vault-share tokens, on-chain AI decisions, oracle-verified pricing, on-chain risk caps, and live Drift execution.

## Short Description
Fornex Protocol is a Solana devnet AI trading vault where users deposit devnet SOL and receive real $FNRX SPL vault-share tokens. Deposits mint $FNRX through Token Program CPI; withdrawals burn $FNRX before returning SOL. A multi-agent AI system (BULL, BEAR, ZEN) debates every trade every 15 minutes; all votes and consensus are written permanently on-chain. Per-agent leverage caps, a 60% confidence floor for executed trades, and ±10% NAV write bounds are enforced inside the Anchor program — the agent cannot override them. Realized PnL from closed Drift positions feeds an on-chain `record_trade_outcome` instruction that drives an honest win-rate metric.

## Live Links

| Resource | Link |
|---|---|
| Live App | https://fornexlab.vercel.app/ |
| Demo Video | [TO BE ADDED — recording in progress] |
| GitHub | https://github.com/rajanpanth/Fornex |
| Program Explorer | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| Vault PDA Explorer | https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet |
| $FNRX Mint Explorer | https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet |

## Quick Reference

```
Live App:   https://fornexlab.vercel.app
Program ID: H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf
Vault PDA:  HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR
$FNRX Mint: BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj
Network:    Solana Devnet
```

## Technical Highlights (v0.3)

- **Real $FNRX SPL vault-share token** — visible in Phantom wallet
- **Token Program CPI mint/burn** — deposit mints, withdraw burns; pure on-chain
- **Pluggable executor adapters** — Synthetic (active) + Drift (wired, awaiting devnet recovery) + Mango/Phoenix on roadmap
- **On-chain synthetic perpetuals** — `open_synthetic_position` / `close_synthetic_position` Pyth-marked at both ends; settles atomically into vault counters
- **On-chain NAV ledger** — `NavRecord` PDA accounts, rebuildable from chain history
- **Pyth SOL/USD oracle verification** — feed-id-pinned in 3 instructions (decision logger, open synthetic, close synthetic)
- **Multi-agent BULL/BEAR/ZEN consensus** — 3 GPT-4o agents + a deterministic regime guard
- **Bounded NAV writes** — ±10% upside / 25% downside per cycle, enforced in `update_nav.rs`
- **Per-agent leverage caps on-chain** — BULL 3× / BEAR 2× / ZEN 2×
- **Confidence floor on-chain** — 60% required for executed decisions
- **`record_trade_outcome` instruction** — tracks executed-trade count and wins from realized PnL, deposits no longer count as wins
- **Real Drift integration** — agent's Drift sub-account is initialized at `55pSF6jL...` on devnet; gated by `DRIFT_SKIP_EXECUTION` while Drift devnet is in maintenance
- **Treasury-funded pay.sh stream** — every 0.001 SOL "earning" is a real transfer from a separate treasury wallet, viewable on Explorer
- **/api/rpc proxy + cache** — Helius API key never bundled to client
- **Webhook bearer auth** — `/api/webhook` rejects unsigned requests; payloads sanitized before SSE rebroadcast
- **Live landing page preview** — on-chain decisions, no wallet required
- **`getProgramAccounts` for the proof page** — pure chain reads, no database

## On-Chain Risk Caps (verifiable)

| Cap | Value | Where enforced |
|---|---|---|
| BULL leverage | ≤ 3× | `validate_vote` in `log_multi_agent_decision.rs` |
| BEAR leverage | ≤ 2× | same |
| ZEN leverage | ≤ 2× | same |
| Consensus confidence floor | ≥ 60% (when `executed = true`) | `log_multi_agent_decision.rs` |
| NAV write change | within ±10% upside / ±25% downside per cycle | `update_nav.rs` |
| Realized PnL per trade | ≤ 50% of NAV | `record_trade_outcome.rs` |
| Win-rate metric | derived from `executed_trade_count`, not deposits | `record_trade_outcome.rs` |

## Trust Assumptions

| Authority | Can do | Cannot do |
|---|---|---|
| User | Deposit / withdraw their own shares | Anything else |
| Vault PDA | Mint / burn $FNRX, custody SOL | Sign agent or admin operations |
| Agent (hot key, devnet) | `log_multi_agent_decision`, `update_nav` (bounded), `record_nav_snapshot`, `record_trade_outcome` (bounded) | Move user funds; override on-chain caps |
| Admin (hot key, devnet) | `emergency_pause`, `migrate_vault_v2`, `initialize_vault*` | Trade; rotate `agent_authority` |
| Treasury (hot key, devnet) | Fund pay.sh micropayments to the agent wallet | Anything on-chain related to the vault |

**Mainnet plan.** `admin` becomes a Squads multisig; `agent_authority` is held inside a Phala / AWS Nitro enclave with attestation-based provisioning; NAV writes become realized-PnL CPI from a vault-PDA-owned Drift user account.

## Architecture

```
User (Phantom) → deposit SOL → Anchor Vault (Solana Devnet)
                                    ↓
                          $FNRX minted via Token Program CPI
                                    ↓
                          AI Agent (pm2, every 15 min)
                          BULL + BEAR + ZEN debate via GPT-4o
                          Regime guard for one-sided regimes
                          Consensus stored on-chain (Pyth-stamped)
                                    ↓
                          Drift `placePerpOrder` (devnet)
                                    ↓
                          On close: record_trade_outcome(realizedPnl)
                          → executed_trade_count + winning_trades
                                    ↓
                          pay.sh treasury → agent (0.001 SOL/trade)
                                    ↓
                          NAV update only when realized PnL ≠ 0
                                    ↓
                          Helius webhook (bearer auth) → SSE → Frontend
                          Next.js reads via /api/rpc proxy
```

## Judge Demo Checklist

- [ ] Landing page loads with live on-chain decisions (no wallet needed)
- [ ] `/app` dashboard loads
- [ ] Phantom devnet wallet connects
- [ ] Deposit devnet SOL → $FNRX minted and shown in balance
- [ ] Withdraw → $FNRX burned, SOL returned
- [ ] Strategy Orders panel visible with latest decision
- [ ] Pyth/RPC status indicators visible and live
- [ ] Vote breakdown (BULL/BEAR/ZEN) visible in decision cards, with at least one executed
- [ ] At least one decision card links to a real Drift transaction
- [ ] Agent Earnings panel ticks up on real treasury → agent transfer (verifiable on Explorer)
- [ ] Win Rate displays "—" when no executed trades exist; updates honestly afterwards
- [ ] Vault NAV pill never shows the old hardcoded -50% bug
- [ ] Explorer links open correctly on devnet
- [ ] PM2 logs show boxed autonomous agent output

## Vercel Environment Variables

Set these in Vercel project settings → Environment Variables. Server-only
secrets must NOT use the `NEXT_PUBLIC_` prefix.

```
# Public (safe to bundle)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_VAULT_PROGRAM_ID=H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf
NEXT_PUBLIC_VAULT_ADDRESS=HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR
NEXT_PUBLIC_FNRX_MINT=BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj
NEXT_PUBLIC_AGENT_PUBKEY=<agent public key>

# Server-only — used by /api/rpc and /api/webhook
HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
HELIUS_WEBHOOK_SECRET=<random hex>
```

## Helius Webhook Setup

| Setting | Value |
|---|---|
| Account Addresses | `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf` |
| Transaction Types | `PROGRAM_INTERACTION` |
| Webhook Type | `enhanced` |
| Webhook URL | `https://fornexlab.vercel.app/api/webhook` |
| Authentication | `Bearer ${HELIUS_WEBHOOK_SECRET}` |

## Build Notes

```bash
# Frontend
npm install
npm run build    # runs the secret-grep guard before next build

# Anchor (requires no spaces in path on Windows; HOME env must be set)
$env:HOME = $env:USERPROFILE   # Windows only
anchor build
anchor deploy --provider.cluster devnet
```

## Safety / Honesty

This is a **Solana devnet hackathon prototype**. It is not audited, not deployed on mainnet, and not intended for real user funds. All transactions use devnet SOL with no real monetary value. Trust assumptions and the mainnet plan are listed above.
