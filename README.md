# Fornex Protocol 🦊

> The non-custodial AI trading vault where every decision has an on-chain
> receipt — and the agent gets paid per trade, on-chain, from a separate
> treasury.

Built for **Solana India Cohort Capstone — 2026**.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)]()
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue)]()
[![GPT-4o](https://img.shields.io/badge/AI-GPT--4o-green)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

🌐 **Live →** https://fornexlab.vercel.app
🧑‍⚖️ **For judges →** https://fornexlab.vercel.app/judges
🧾 **On-chain proof →** https://fornexlab.vercel.app/proof

## What it is in 30 seconds

Three specialized LLM agents — **BULL** (momentum), **BEAR** (contrarian),
**ZEN** (risk-focused tiebreaker) — debate every 15 minutes. A 2/3 majority
wins, confidence ≥ 60% required to execute. Every vote, leverage cap, and
NAV write is enforced **inside the Anchor program** — the agent cannot
break them. Each cycle writes a `MultiAgentDecision` PDA with full BULL /
BEAR / ZEN reasoning, and on every executed trade a separate **treasury
wallet streams 0.001 SOL** to the agent on-chain (pay.sh-style).

Default executor is **Synthetic** — Pyth-marked perpetual positions
written as `SyntheticPosition` PDAs inside the Fornex program itself, no
external dex dependency. The Drift executor is wired and switchable via
`FORNEX_EXECUTOR=drift`.

## Why this wins (TL;DR)

- **Multi-agent governance with on-chain caps.** BULL ≤ 3×, BEAR ≤ 2×, ZEN ≤ 2×, consensus confidence ≥ 60%, NAV writes within ±10% / cycle, single-trade PnL within ±50% of NAV. All enforced in Anchor (`programs/fornex/src/instructions/`). The agent literally cannot override them.
- **The reasoning lives on-chain, not just the price.** Each `MultiAgentDecision` PDA reserves 200 bytes per agent for prose reasoning + Pyth-stamped price + confidence. `/proof` decodes this directly from Solana.
- **Per-agent on-chain reputation.** `AgentReputation` PDA tracks BULL / BEAR / ZEN win rate from realized PnL on closed trades. FLAT votes excluded. Counters bounded by `executed_trade_count` so the agent key can't inflate them.
- **Vault-level strategy modes.** `VaultStrategy` PDA holds an admin-set mode byte (Momentum / MeanRevert / RangeDCA). The brain reads it at the top of every cycle and switches its three system prompts. One byte on chain, three different trading personalities live.
- **Synthetic Pyth-marked perps as a self-contained primitive.** When Drift devnet wobbles, Fornex still trades — `open_synthetic_position` and `close_synthetic_position` mark against Pyth and bound PnL inside the program.
- **Real per-trade streaming agent payments.** Every executed trade fires a `SystemProgram::transfer` from a separate **treasury keypair** to the agent wallet. Not a self-transfer; the code refuses to fake one (`agent/src/paysh.ts`).
- **Honest stats.** `record_trade_outcome` increments win counters only on closed positions with realized PnL. Inception NAV is stamped on-chain so depositor PnL is anchored to a real start point. Deposits never count as wins.
- **Operational reliability.** PM2-supervised cycle, regime guard against unanimous-FLAT debates, `/api/rpc` proxy + cache so the Helius key never hits the browser, bearer-authed webhook with payload sanitization.

## Verify in 30 seconds

Every claim above resolves to an account on Solana devnet. Click any row.

| What | Where on chain |
|---|---|
| Anchor program | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| Vault PDA (NAV, share supply, trade counters) | https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet |
| $FNRX share token mint | https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet |
| Agent wallet (executes Drift / synthetic perps) | https://explorer.solana.com/address/2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n?cluster=devnet |
| Treasury wallet (funds pay.sh stream) | https://explorer.solana.com/address/HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat?cluster=devnet |
| All decisions, decoded | https://fornexlab.vercel.app/proof |

## Architecture

```
       Depositor (Phantom)
              │
              ▼
   ┌──────────────────────────┐        Pyth oracle
   │   Vault PDA  · $FNRX     │◄─────  (SOL/USD)
   │   on-chain shares        │
   └────────────┬─────────────┘
                │  read NAV
                ▼
   ┌──────────────────────────┐
   │   Brain  (15m cycle)     │
   │   BULL · BEAR · ZEN      │
   │   debate + consensus     │
   └────────────┬─────────────┘
                │
   ┌────────────┴───────────────┐
   ▼                            ▼
MultiAgentDecision     Synthetic / Drift
PDA  (proof)           perp executor
   │                            │
   │                            ▼
   │                     SyntheticPosition PDA
   │                     (Pyth-marked PnL)
   ▼
record_trade_outcome  →  pay.sh stream
(executed_trade_count)    (treasury → agent)
```

No external orchestrator, no off-chain trade bus, no centralized risk service.
The Anchor program is the only authority that can change vault state.

## Roadmap

**Shipped (devnet)**
- BULL / BEAR / ZEN multi-agent brain on a 15m cycle with regime guard
- Caps enforced inside the Anchor program (3× / 2× / 2×, ±10% NAV, ≥ 60% confidence)
- `MultiAgentDecision` PDAs with full reasoning, decoded on `/proof`
- Synthetic Pyth-marked perps as a self-contained executor
- Drift execution path wired (gated via `DRIFT_SKIP_EXECUTION`)
- Pay.sh streaming micropayments on every executed trade
- Inception NAV stamped on-chain; honest win-rate from realized PnL
- Per-agent on-chain reputation: BULL / BEAR / ZEN win rate from realized PnL
- Vault-level strategy modes (Momentum / MeanRevert / RangeDCA) gated on chain
- Decision drawer with full reasoning trace, FNV-1a tamper hash, and consensus receipt
- Live `logsSubscribe` decision stream with auto-reconnect (no SSE / no backend)
- Risk dashboard: drawdown, high-water mark, longest losing streak, Sharpe-like ratio — all client-side from on-chain `NavRecord` history
- Public read-only `@fornex/sdk` package (`packages/sdk/`, viem-style, peer-deps `@solana/web3.js` only)

**In progress**
- Helius webhook → SSE decision feed (writeable across serverless)
- Strategy-mode-aware risk caps on-chain
- Squads multisig on the treasury wallet
- `cargo publish` of the on-chain CPI types crate

**Mainnet plan**
- Vault-PDA CPI signing into Drift (no agent custody of trading capital)
- Squads multisig on the treasury wallet
- Public read-only `@fornex/sdk` on npm
- Depositor-defined leverage and confidence floors

## 🌐 Links

| Resource | Link |
|---|---|
| Live App | https://fornexlab.vercel.app |
| For judges | https://fornexlab.vercel.app/judges |
| On-Chain Proof | https://fornexlab.vercel.app/proof |
| Demo Video | [Recording in progress] |
| Program | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| Vault PDA | https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet |
| $FNRX Token | https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet |

## What's New (v0.2 — hardened)

- **Bounded NAV writes** ±10% per cycle, enforced in `update_nav` on-chain.
- **Per-agent leverage caps** BULL 3× / BEAR 2× / ZEN 2×, enforced in `log_multi_agent_decision`.
- **Confidence floor** 60% on executed decisions, enforced on-chain.
- **`record_trade_outcome` instruction** ties win-rate to closed-position PnL, not deposits.
- **Real Drift execution** — agent initializes a Drift user account and deposits SOL collateral on first run; `placePerpOrder` actually fires now.
- **Treasury-funded pay.sh stream** — 0.001 SOL per executed trade transferred from a separate treasury wallet → agent wallet, every payment a real on-chain signature.
- **Regime guard** in `brain.ts` so the debate doesn't unanimously FLAT through one-sided regimes.
- **`/api/rpc` proxy + cache** — Helius key never reaches the browser.
- **Webhook bearer auth** + payload sanitization on `/api/webhook`.

## What Makes This Technically Heavy

| Feature | Technology | Why It's Hard |
|---|---|---|
| Vault Shares | Real SPL Token ($FNRX) | Token Program CPI in Rust |
| Trade Allocation | 5% of vault NAV dynamically | On-chain math |
| Performance History | NavRecord accounts on Solana | Custom PDA indexing |
| Real-time Feed | Helius webhook + polling | Blockchain indexing |
| Trade Execution | Drift Protocol SDK | DeFi protocol integration |
| AI Agents | GPT-4o × 3 parallel + regime guard | Multi-agent consensus |
| Payments | pay.sh streaming | Treasury → agent transfers |
| Transparency | On-chain reasoning (200 bytes/agent) | Permanent + auditable |
| Risk Caps | All caps in Anchor program | Agent cannot override |

## The Three Agents

| Agent | Personality | Max Leverage (on-chain) | Signal Focus |
|---|---|---|---|
| 🐂 BULL | Momentum / squeeze | 3× | Negative funding, rising OI, crowded shorts |
| 🐻 BEAR | Contrarian | 2× | Extreme L/S ratio, positive funding, mark/index spread |
| ⚖️ ZEN | Risk-focused tiebreaker | 2× | Liquidation walls, spread, regime stability |

**Consensus: 2/3 majority wins. Confidence ≥ 60% required to execute (enforced on-chain).**

## Strategy / Regime Guard

LLM agents are not always reliable. To prevent the dashboard from looking
broken in extreme regimes (e.g. all three personas defaulting to FLAT when
markets are plainly one-sided), `brain.ts` ships a deterministic regime
guard that runs only when *all three agents return FLAT*:

- L/S ratio > 2.0 OR funding > 0.02%/hr → BEAR flips to SHORT 1.5× at 60% confidence (mean-reversion).
- L/S ratio < 0.6 OR funding < -0.02%/hr → BULL flips to LONG 1.5× at 60% confidence (squeeze thesis).
- Otherwise unanimous FLAT stands.

This is a documented prior, not a market call. Source: `agent/src/brain.ts` `applyRegimeGuard`.

## Live Trades (Synthetic Executor)

The Synthetic executor settles synthetic perpetual positions on a Fornex-owned
PDA, price-marked against Pyth at open and close. No external dex dependency
required. The Drift executor is wired but currently inactive while Drift
devnet is in maintenance (April 2026 hack mitigation).

| Action | Tx | Account |
|---|---|---|
| Open LONG (0.25 SOL collateral, 1×) | https://explorer.solana.com/tx/VkFHkwQCmsskpbBowypviXmWgU2RzdDr8aEPSaBNtAhrzcz55NLWR88abxyYrc1aiQxX9PXFyXeapovKGZKGE9i?cluster=devnet | https://explorer.solana.com/address/4HgQmJQpk2gk1yAf4iL8kLd6uG6yz8LC2GVaz4sg2sod?cluster=devnet |
| Close LONG (realized PnL −0.000131 SOL) | https://explorer.solana.com/tx/5jhx2pFvL8Fsz44aGRWs6btiwrLbpG7MgYQSVdrvBiZ5ewzFMRJE5383tUEofHWvB1EdVDdjHwCgAnuVCarp4xeT?cluster=devnet | (same PDA, now closed) |
| Open SHORT (0.25 SOL, 1×) | https://explorer.solana.com/tx/cggpvmoZrzyj5g8XMvXLCNgmhTjgwNzvCytkmRooGYZAHuPCZFPCj9ZzMeZno8NLU85QxZ8b4NNuGrgVhsXEQxt?cluster=devnet | https://explorer.solana.com/address/DtSxQZxSw3XwZHiDFM9MdrR72u7Bt3MLf8KxsBH7E5cg?cluster=devnet |
| Close SHORT (realized PnL −0.000043 SOL) | https://explorer.solana.com/tx/5XYmctUzLMFntSpfsJfc8Z27gBdJorfEeX5wQqAiVcKTcJGuRqJdpEA5RYDZ9vNyiY9ibDPkR9geyqrkJUVB1LJf?cluster=devnet | (same PDA, now closed) |
| pay.sh treasury → agent (last) | https://explorer.solana.com/tx/2bzfMVKnGCh8KkoBuAf7oAkcNH8T5cd79UgA69zqbGNMxu6CfLQVMjMRLsV866nD5j87qxt6Agw3oVpSo6vnLaAw?cluster=devnet | — |

After both round trips: `executedTradeCount = 2`, `syntheticPositionCount = 2`,
`navRecordCount = 32`, NAV = 5.000825625 SOL (moved down by realized PnL).

## Executor Adapters

Fornex's executor layer is pluggable. The agent picks one adapter at startup
via `FORNEX_EXECUTOR`:

| Adapter | Status | Notes |
|---|---|---|
| `synthetic` (default) | **Active** | On-chain Pyth-marked synthetic perps. Open/close via Fornex's `open_synthetic_position` / `close_synthetic_position` instructions. PnL settles atomically into vault counters. |
| `drift` | Wired, inactive | Drift Protocol devnet integration. Agent's Drift sub-account is live at [`55pSF6jL...`](https://explorer.solana.com/address/55pSF6jL6b5mMoiSjuMsbfD1PfJhTApLcBnPsZ3guHE2?cluster=devnet). Set `FORNEX_EXECUTOR=drift` after Drift devnet recovers. |
| `mango`, `phoenix` | Roadmap | Same interface; future adapters. |

The Synthetic executor is **not a mock** — every position is a real on-chain
PDA, every price is a real Pyth Lazer reading verified in Rust, every PnL
calculation is bounded ±50% of NAV by the Anchor program.

### v0.3 Migration & Redeploy (already complete on devnet)

| Action | Tx |
|---|---|
| Anchor program upgrade (v0.3 — adds synthetic executor) | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| `migrate_vault_v2` (134 → 138 bytes, adds `synthetic_position_count`) | https://explorer.solana.com/tx/2YLPA8tFUNR4qhHjKUkFLhX4UZ6bYVBXCLJtYLJ9cJgiSmPMRkL9SriTcpdNKSbwzeN11LcbrCXUQ75DyeesWNzV?cluster=devnet |

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

| Authority | What it can do | What it cannot do |
|---|---|---|
| User wallet | Deposit / withdraw their own shares | Anything else |
| Vault PDA | Mint / burn $FNRX, custody SOL | Sign agent or admin operations |
| Agent (hot key, devnet) | `log_multi_agent_decision`, `update_nav` (bounded), `record_nav_snapshot`, `record_trade_outcome` (bounded), `update_agent_reputation` | Move user funds. Override leverage caps. Change admin. |
| Admin (hot key, devnet) | `emergency_pause`, `migrate_vault_v2`, `initialize_vault*`, `init_agent_reputation`, `init_vault_strategy`, `set_strategy_mode` | Trade. Change `agent_authority` (single-shot at init). |
| Treasury (hot key, devnet) | Fund pay.sh micropayments to the agent wallet | Anything on-chain related to the vault |

## Treasury safety (Squads-ready)

The treasury wallet that funds the pay.sh stream is a separate keypair from
the agent. Two-tier model so a hot-key compromise has bounded blast radius:

| Layer | Devnet | Mainnet plan |
|---|---|---|
| **Source of funds** | Solana faucet | Squads multisig vault |
| **Spender (signs each pay.sh tx)** | `FORNEX_TREASURY_KEYPAIR` (hot) | Same hot keypair, *budgeted* |
| **Top-up cadence** | Manual | Scheduled `vault_transaction` (e.g. 1 SOL / month) |
| **Compromise radius** | Whatever's in the keypair | Residual budget only — never the multisig vault |

The runtime surfaces this provenance via `FORNEX_TREASURY_SOURCE`. Set it
to `squads:<MULTISIG_PUBKEY>` and the agent log line becomes:

```
💸 pay.sh: 0.001 SOL streamed squads:abcd…wxyz→agent | Total: 0.014 SOL | tx: 5fK…
```

The same env var, exposed to the frontend as `NEXT_PUBLIC_FORNEX_TREASURY_SOURCE`,
flips the **/judges** "Treasury safety" callout to show the multisig vault
with a one-click Explorer link.

> Squads orchestration (proposing/executing the monthly top-up) is an
> operational task scheduled outside Fornex — the protocol does not enforce
> it on chain. The marker is provenance, not enforcement.

**Mainnet plan.** Move `admin` to a Squads multisig. Hold `agent_authority` in a Phala / AWS Nitro enclave with attestation-based provisioning. Replace direct `update_nav` discretion with realized-PnL CPI from a vault-owned Drift user.

## How It Works

```
User deposits SOL -> receives real $FNRX SPL vault shares (1:1 at first deposit)
         |
Every 15 minutes (autonomous, no human needed):
         |
+-------------------------------------+
|  BULL 🐂  reads: funding rate, OI   |
|  BEAR 🐻  reads: L/S ratio, spread  |  -> 3 votes
|  ZEN  ⚖️   reads: liq walls, vol    |
+-------------------------------------+
         |
Regime guard if all-FLAT (see Strategy)
         |
Majority vote -> if confidence >= 60% -> placePerpOrder on Drift
         |
ALL 3 votes + reasoning -> stored on Solana decision PDA
         |
On close: record_trade_outcome(pnl) increments win counters honestly
         |
pay.sh streams 0.001 SOL treasury -> agent
         |
NAV updates only when realized PnL is non-zero
```

## Technical Stack

| Layer | Technology |
|---|---|
| Smart Contract | Anchor (Rust) — 12 instructions including `record_trade_outcome` |
| Perp Trading | Drift Protocol SDK (devnet) |
| AI Agents | Azure OpenAI GPT-4o |
| Agent Loop | TypeScript + pm2 (15-min cycles) |
| Payments | Treasury → agent SystemProgram::transfer (pay.sh-style streaming) |
| Frontend | Next.js + pure CSS |
| Wallet | Phantom + @solana/wallet-adapter |
| Shares | SPL Token Program + Associated Token Accounts |
| Oracle | Pyth Solana Receiver |
| Indexing | Helius webhook (bearer-auth) + 30-second polling fallback |

## Smart Contract Instructions

| Instruction | Description |
|---|---|
| initialize_vault | Creates vault PDA, sets agent authority |
| initialize_vault_with_mint | Creates vault PDA plus $FNRX mint |
| initialize_vault_mint | One-time live-vault migration for $FNRX |
| migrate_vault_v2 | Reallocs legacy vault for NAV ledger + executed trade fields, backfills inception_nav |
| deposit | User sends SOL, receives proportional $FNRX, stamps inception NAV on first deposit |
| withdraw | Burns $FNRX, returns proportional SOL |
| log_multi_agent_decision | Stores all 3 votes plus Pyth price, enforces leverage caps + confidence floor |
| log_trade | Records individual trade execution reference |
| update_nav | Bounded ±10% upside / 25% downside NAV write |
| record_nav_snapshot | Creates an immutable NavRecord PDA |
| record_trade_outcome | Increments executed_trade_count + winning_trades on positive PnL |
| open_synthetic_position | Opens a synthetic perp position price-marked by Pyth |
| close_synthetic_position | Settles the position with Pyth close price, bumps win counters |
| emergency_pause / resume | Admin-only halts or resumes agent trading |

## Getting Started

```bash
# 1. Clone (use a path without spaces; anchor build fails on Windows otherwise)
git clone https://github.com/YOUR_USERNAME/fornex-protocol C:\fornex
cd C:\fornex

# 2. Install dependencies
npm install
cd agent && npm install && cd ..

# 3. Configure environment
cp .env.local.example .env.local
cp agent/.env.example agent/.env
# Fill in AGENT_KEYPAIR (devnet airdrop ~3 SOL first),
#         FORNEX_TREASURY_KEYPAIR (separate wallet, devnet airdrop ~1 SOL),
#         AZURE_OPENAI_*,
#         HELIUS_RPC_URL (server-only),
#         HELIUS_WEBHOOK_SECRET (server-only)

# 4. Build and deploy the program (skip if redeploying to existing devnet ID)
anchor build
anchor deploy --provider.cluster devnet

# 5. Run frontend
npm run dev -- -p 3001

# 6. Bake one LONG and one SHORT into the on-chain history
FORNEX_FORCE_DIRECTION=LONG  FORNEX_SINGLE_CYCLE=1 npm run agent
FORNEX_FORCE_DIRECTION=SHORT FORNEX_SINGLE_CYCLE=1 npm run agent

# 7. Start the live cycle
cd agent && pm2 start "npx ts-node src/index.ts" --name fornex-agent
```

## Helius Webhook Setup

Configure in the [Helius dashboard](https://dev.helius.xyz/dashboard/app):

| Setting | Value |
|---|---|
| Account Addresses | `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf` |
| Transaction Types | `PROGRAM_INTERACTION` |
| Webhook Type | `enhanced` |
| Webhook URL | `https://fornexlab.vercel.app/api/webhook` |
| Authentication | `Bearer ${HELIUS_WEBHOOK_SECRET}` |

The endpoint rejects any POST that does not present the secret. Payloads are
sanitized down to `{ signature, type, timestamp, programId }` before being
broadcast to SSE clients, so a compromised webhook source cannot inject HTML
or JS into the dashboard.

> **Note:** Vercel serverless functions don't hold persistent connections, so SSE is best-effort. The 30-second polling fallback keeps the UI fresh regardless.

## On-Chain Proof

Every cycle creates a new `MultiAgentDecision` PDA. Browse them all at:
https://fornexlab.vercel.app/proof

Each account stores:
- BULL / BEAR / ZEN votes (direction, leverage, confidence, 200-byte reasoning each)
- Consensus vote
- Pyth-verified SOL price + confidence
- Execution status + tx reference
- Timestamp

NAV snapshots live in standalone `NavRecord` PDAs so the equity curve rebuilds
directly from chain history.

## Known Limitations (Devnet Prototype)

- Agent executes trades from its own Drift user account, not a vault-PDA CPI. NAV updates are computed off-chain from realized PnL and reported back on-chain (bounded ±10%).
- `agent_authority` is a single hot key on devnet (see Trust Assumptions for the mainnet plan).
- `emergency_pause` halts trading and NAV updates but not deposits / withdrawals.
- `signals.ts` reads Drift mainnet markets read-only because devnet markets have ~0 volume; trading itself stays on devnet.
- Devnet RPC throughput is rate-limited; the production deploy uses a Helius URL via `/api/rpc`.

## Disclaimer

This is a **Solana devnet hackathon prototype**. It is not audited, not deployed
on mainnet, and not intended for real user funds. All transactions use devnet SOL
with no real monetary value.

---

Built for Solana India Cohort Capstone — 2026
