<div align="center">

# Fornex Protocol 🦊

**The non-custodial AI trading vault where every decision has an on-chain receipt — and the agent gets paid per trade, on-chain, from a separate treasury.**

Built for **Solana India Cohort Capstone — 2026**

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)]()
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue)]()
[![GPT-4o](https://img.shields.io/badge/AI-GPT--4o-green)]()
[![Agent](https://img.shields.io/badge/Agent-24%2F7%20on%20Azure-0078D4)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

🌐 **[Live App](https://fornexlab.vercel.app)** · 🧑‍⚖️ **[For Judges](https://fornexlab.vercel.app/judges)** · 🧾 **[On-Chain Proof](https://fornexlab.vercel.app/proof)** · 💻 **[GitHub](https://github.com/rajanpanth/Fornex)**

</div>

---

## Table of Contents

- [What it is in 30 seconds](#what-it-is-in-30-seconds)
- [Why this wins](#why-this-wins-tldr)
- [Verify in 30 seconds](#verify-in-30-seconds)
- [Architecture](#architecture)
- [Always-on agent (Azure VM)](#always-on-agent-azure-vm)
- [The three agents](#the-three-agents)
- [Regime guard](#regime-guard)
- [Per-agent reputation (computed on-chain)](#per-agent-reputation-computed-on-chain)
- [Executor adapters](#executor-adapters)
- [Live trades](#live-trades-synthetic-executor)
- [On-chain risk caps](#on-chain-risk-caps-verifiable)
- [Trust assumptions](#trust-assumptions)
- [Treasury safety](#treasury-safety-squads-ready)
- [Technical stack](#technical-stack)
- [Smart contract instructions](#smart-contract-instructions)
- [API surface](#api-surface)
- [Getting started](#getting-started)
- [Roadmap](#roadmap)
- [Known limitations](#known-limitations-devnet-prototype)
- [Disclaimer](#disclaimer)

---

## What it is in 30 seconds

Three specialized LLM agents — **BULL** (momentum), **BEAR** (contrarian), **ZEN** (risk-focused tiebreaker) — debate every 15 minutes. A 2/3 majority wins, confidence ≥ 60% required to execute. Every vote, leverage cap, and NAV write is enforced **inside the Anchor program** — the agent cannot break them. Each cycle writes a `MultiAgentDecision` PDA with full BULL / BEAR / ZEN reasoning, and on every executed trade a separate **treasury wallet streams 0.001 SOL** to the agent on-chain (pay.sh-style).

The agent isn't a laptop script. It runs **24/7 inside a Docker container on an Azure VM**, waking every 15 minutes and restarting itself on crash or reboot.

The default executor is **Synthetic** — Pyth-marked perpetual positions written as `SyntheticPosition` PDAs inside the Fornex program itself, with no external dex dependency. The Drift executor is wired and switchable via `FORNEX_EXECUTOR=drift`.

---

## Why this wins (TL;DR)

- **Multi-agent governance with on-chain caps.** BULL ≤ 3×, BEAR ≤ 2×, ZEN ≤ 2×, consensus confidence ≥ 60%, NAV writes within ±10% upside / ±25% downside per cycle, single-trade PnL within ±50% of NAV. All enforced in Anchor (`programs/fornex/src/instructions/`). The agent literally cannot override them.
- **The reasoning lives on-chain, not just the price.** Each `MultiAgentDecision` PDA reserves 200 bytes per agent for prose reasoning + Pyth-stamped price + confidence. `/proof` decodes this directly from Solana.
- **Per-agent reputation, computed from realized PnL.** BULL / BEAR / ZEN win rate is derived on-chain by joining each persona's vote to the realized PnL of the position it opened. FLAT votes excluded. No database, no trust required — see [Per-agent reputation](#per-agent-reputation-computed-on-chain).
- **Synthetic Pyth-marked perps as a self-contained primitive.** When Drift devnet wobbles, Fornex still trades — `open_synthetic_position` and `close_synthetic_position` mark against Pyth and bound PnL inside the program.
- **Real per-trade streaming agent payments.** Every executed trade fires a `SystemProgram::transfer` from a separate **treasury keypair** to the agent wallet. Not a self-transfer; the code refuses to fake one (`agent/src/paysh.ts`).
- **Honest stats.** `record_trade_outcome` increments win counters only on closed positions with realized PnL. Inception NAV is stamped on-chain so depositor PnL is anchored to a real start point. Deposits never count as wins.
- **Always on.** Dockerized agent on an Azure VM with `--restart unless-stopped`, a regime guard against unanimous-FLAT debates, an `/api/rpc` proxy + cache so the Helius key never hits the browser, and a bearer-authed webhook with payload sanitization.

---

## Verify in 30 seconds

Every claim above resolves to an account on Solana devnet. Click any row.

| What | Where on chain |
|---|---|
| Anchor program | [`H6vb…T6vZf`](https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet) |
| Vault PDA (NAV, share supply, trade counters) | [`HMkL…gBXR`](https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet) |
| $FNRX share token mint | [`BNBf…94vj`](https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet) |
| Agent wallet (executes perps) | [`2BD1…Nu3n`](https://explorer.solana.com/address/2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n?cluster=devnet) |
| Treasury wallet (funds pay.sh stream) | [`HHy3…oYat`](https://explorer.solana.com/address/HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat?cluster=devnet) |
| All decisions, decoded | [fornexlab.vercel.app/proof](https://fornexlab.vercel.app/proof) |

---

## Architecture

```
       Depositor (Phantom)
              │
              ▼
   ┌──────────────────────────┐        Pyth oracle
   │   Vault PDA  ·  $FNRX     │◄─────  (SOL/USD)
   │   on-chain shares         │
   └────────────┬─────────────┘
                │  read NAV
                ▼
   ┌──────────────────────────┐    Azure VM · Docker · 24/7
   │   Brain  (15m cycle)     │ ◄── wakes every 15 min,
   │   BULL · BEAR · ZEN      │     restarts on crash/reboot
   │   debate + consensus     │
   └────────────┬─────────────┘
                │
   ┌────────────┴───────────────┐
   ▼                            ▼
MultiAgentDecision      Synthetic / Drift
PDA  (proof)            perp executor
   │                            │
   │                            ▼
   │                     SyntheticPosition PDA
   │                     (Pyth-marked PnL)
   ▼                            │
record_trade_outcome  ◄─────────┘
(executed_trade_count)
   │
   ▼
pay.sh stream  (treasury → agent, 0.001 SOL / executed trade)
```

No external orchestrator, no off-chain trade bus, no centralized risk service. The Anchor program is the only authority that can change vault state.

---

## Always-on agent (Azure VM)

The agent is a self-contained TypeScript runtime that runs continuously — not on demand, not on a laptop.

| Aspect | Detail |
|---|---|
| **Host** | Azure Virtual Machine (Linux) |
| **Packaging** | Docker (`agent/Dockerfile`, `node:20-bookworm-slim`), agent directory only — no Next.js workspace |
| **Process supervision** | Container runs with `--restart unless-stopped`; `pm2-runner.js` boots `ts-node` and the agent entrypoint |
| **Cadence** | One full cycle every 15 minutes (`LOOP_MS = 900_000`) |
| **Inbound traffic** | None. The agent has no HTTP server — it only reads market signals and writes to Solana |
| **Crash / reboot behavior** | Comes back up automatically; the loop is idempotent and re-reads on-chain state each cycle |

Each cycle the container: reads the on-chain vault NAV → fetches market signals → asks BULL/BEAR/ZEN for votes → forms consensus → opens/closes a position when warranted → writes a `MultiAgentDecision` PDA → streams the pay.sh micropayment on executed trades.

```bash
# On the Azure VM
docker build -t fornex-agent ./agent
docker run -d --name fornex-agent --restart unless-stopped \
  --env-file ./agent/.env fornex-agent
```

> The frontend (`fornexlab.vercel.app`) is hosted separately on Vercel. Only the autonomous agent runs on the Azure VM.

---

## The three agents

| Agent | Personality | Max leverage (on-chain) | Signal focus |
|---|---|---|---|
| 🐂 BULL | Momentum / squeeze | 3× | Negative funding, rising OI, crowded shorts |
| 🐻 BEAR | Contrarian | 2× | Extreme L/S ratio, positive funding, mark/index spread |
| ⚖️ ZEN | Risk-focused tiebreaker | 2× | Liquidation walls, spread, regime stability |

**Consensus: 2/3 majority wins. Confidence ≥ 60% required to execute (enforced on-chain).**

---

## Regime guard

LLM agents are not always reliable. To prevent the dashboard from looking broken in extreme regimes (e.g. all three personas defaulting to FLAT when markets are plainly one-sided), `brain.ts` ships a deterministic regime guard that runs **only when all three agents return FLAT**:

- L/S ratio > 2.0 OR funding > 0.02%/hr → BEAR flips to SHORT 1.5× at 60% confidence (mean-reversion).
- L/S ratio < 0.6 OR funding < −0.02%/hr → BULL flips to LONG 1.5× at 60% confidence (squeeze thesis).
- Otherwise unanimous FLAT stands.

This is a documented prior, not a market call. Source: `agent/src/brain.ts` → `applyRegimeGuard`.

---

## Per-agent reputation (computed on-chain)

The **Agent reputation** card on `/app` shows each persona's closed-trade win rate. It's not stored — it's **computed live from data that already exists on-chain**, then served by `/api/reputation`:

- Each persona's vote direction lives in the `MultiAgentDecision` PDA.
- Realized PnL lives in the `SyntheticPosition` PDA (`realized_pnl_lamports`).
- For each closed position we find the decision that opened it (same direction, nearest open timestamp) and score with the exact rule the on-chain `update_agent_reputation` uses:

  - FLAT vote → excluded (no directional call)
  - LONG vote & PnL > 0 → correct
  - SHORT vote & PnL < 0 → correct
  - PnL == 0 → counts toward total, never correct

This keeps the metric honest and verifiable without a database — anyone can recompute it from the same accounts.

> **Why computed and not a single PDA?** The `update_agent_reputation` / `init_agent_reputation` instructions exist in source, but the currently deployed devnet program is **immutable** (no upgrade authority), so the dedicated `AgentReputation` PDA can't be initialized against it. Computing from the existing decision + position accounts makes the feature real today, with no redeploy. Activating the dedicated PDA path is part of the next fresh deploy (see [Roadmap](#roadmap)).

---

## Executor adapters

Fornex's executor layer is pluggable. The agent picks one adapter at startup via `FORNEX_EXECUTOR`:

| Adapter | Status | Notes |
|---|---|---|
| `synthetic` (default) | **Active** | On-chain Pyth-marked synthetic perps via `open_synthetic_position` / `close_synthetic_position`. PnL settles atomically into vault counters. |
| `drift` | Wired, inactive | Drift Protocol devnet integration. Agent's Drift sub-account is live at [`55pSF6jL…`](https://explorer.solana.com/address/55pSF6jL6b5mMoiSjuMsbfD1PfJhTApLcBnPsZ3guHE2?cluster=devnet). Set `FORNEX_EXECUTOR=drift` after Drift devnet recovers. |
| `mango`, `phoenix` | Roadmap | Same interface; future adapters. |

The Synthetic executor is **not a mock** — every position is a real on-chain PDA, every price is a real Pyth reading verified in Rust, every PnL calculation is bounded ±50% of NAV by the Anchor program.

---

## Live trades (Synthetic executor)

Positions settle on a Fornex-owned PDA, price-marked against Pyth at open and close. No external dex dependency. (The Drift executor is wired but inactive while Drift devnet is in maintenance.)

| Action | Tx | Account |
|---|---|---|
| Open LONG (0.25 SOL collateral, 1×) | [tx](https://explorer.solana.com/tx/VkFHkwQCmsskpbBowypviXmWgU2RzdDr8aEPSaBNtAhrzcz55NLWR88abxyYrc1aiQxX9PXFyXeapovKGZKGE9i?cluster=devnet) | [PDA](https://explorer.solana.com/address/4HgQmJQpk2gk1yAf4iL8kLd6uG6yz8LC2GVaz4sg2sod?cluster=devnet) |
| Close LONG (realized PnL −0.000131 SOL) | [tx](https://explorer.solana.com/tx/5jhx2pFvL8Fsz44aGRWs6btiwrLbpG7MgYQSVdrvBiZ5ewzFMRJE5383tUEofHWvB1EdVDdjHwCgAnuVCarp4xeT?cluster=devnet) | (same PDA, now closed) |
| Open SHORT (0.25 SOL, 1×) | [tx](https://explorer.solana.com/tx/cggpvmoZrzyj5g8XMvXLCNgmhTjgwNzvCytkmRooGYZAHuPCZFPCj9ZzMeZno8NLU85QxZ8b4NNuGrgVhsXEQxt?cluster=devnet) | [PDA](https://explorer.solana.com/address/DtSxQZxSw3XwZHiDFM9MdrR72u7Bt3MLf8KxsBH7E5cg?cluster=devnet) |
| Close SHORT (realized PnL −0.000043 SOL) | [tx](https://explorer.solana.com/tx/5XYmctUzLMFntSpfsJfc8Z27gBdJorfEeX5wQqAiVcKTcJGuRqJdpEA5RYDZ9vNyiY9ibDPkR9geyqrkJUVB1LJf?cluster=devnet) | (same PDA, now closed) |
| pay.sh treasury → agent (last) | [tx](https://explorer.solana.com/tx/2bzfMVKnGCh8KkoBuAf7oAkcNH8T5cd79UgA69zqbGNMxu6CfLQVMjMRLsV866nD5j87qxt6Agw3oVpSo6vnLaAw?cluster=devnet) | — |

---

## On-chain risk caps (verifiable)

| Cap | Value | Where enforced |
|---|---|---|
| BULL leverage | ≤ 3× | `validate_vote` in `log_multi_agent_decision.rs` |
| BEAR leverage | ≤ 2× | same |
| ZEN leverage | ≤ 2× | same |
| Consensus confidence floor | ≥ 60% (when `executed = true`) | `log_multi_agent_decision.rs` |
| NAV write change | within ±10% upside / −25% downside per cycle | `update_nav.rs` |
| Realized PnL per trade | ≤ 50% of NAV | `record_trade_outcome.rs` / `close_synthetic_position.rs` |
| Win-rate metric | derived from `executed_trade_count`, not deposits | `record_trade_outcome.rs` |

---

## Trust assumptions

| Authority | What it can do | What it cannot do |
|---|---|---|
| User wallet | Deposit / withdraw their own shares | Anything else |
| Vault PDA | Mint / burn $FNRX, custody SOL | Sign agent or admin operations |
| Agent (hot key, devnet) | `log_multi_agent_decision`, `update_nav` (bounded), `record_nav_snapshot`, `record_trade_outcome` (bounded), `open`/`close_synthetic_position` | Move user funds. Override leverage caps. Change admin. |
| Admin (hot key, devnet) | `emergency_pause` / `resume`, `migrate_vault_v2`, `initialize_vault*` | Trade. Change `agent_authority` (single-shot at init). |
| Treasury (hot key, devnet) | Fund pay.sh micropayments to the agent wallet | Anything on-chain related to the vault |

**Mainnet plan.** Move `admin` to a Squads multisig. Hold `agent_authority` in a Phala / AWS Nitro enclave with attestation-based provisioning. Replace direct `update_nav` discretion with realized-PnL CPI from a vault-owned Drift user.

---

## Treasury safety (Squads-ready)

The treasury wallet that funds the pay.sh stream is a separate keypair from the agent. Two-tier model so a hot-key compromise has bounded blast radius:

| Layer | Devnet | Mainnet plan |
|---|---|---|
| **Source of funds** | Solana faucet | Squads multisig vault |
| **Spender (signs each pay.sh tx)** | `FORNEX_TREASURY_KEYPAIR` (hot) | Same hot keypair, *budgeted* |
| **Top-up cadence** | Manual | Scheduled `vault_transaction` (e.g. 1 SOL / month) |
| **Compromise radius** | Whatever's in the keypair | Residual budget only — never the multisig vault |

Set `FORNEX_TREASURY_SOURCE=squads:<MULTISIG_PUBKEY>` and the agent log line surfaces the provenance:

```
💸 pay.sh: 0.001 SOL streamed squads:abcd…wxyz→agent | Total: 0.014 SOL | tx: 5fK…
```

The same value, exposed to the frontend as `NEXT_PUBLIC_FORNEX_TREASURY_SOURCE`, flips the **/judges** "Treasury safety" callout to show the multisig vault with a one-click Explorer link.

> Squads orchestration (proposing/executing the monthly top-up) is an operational task scheduled outside Fornex — the protocol does not enforce it on chain. The marker is provenance, not enforcement.

---

## Technical stack

| Layer | Technology |
|---|---|
| Smart contract | Anchor (Rust) — 15 instructions live on devnet (4 more code-complete, pending a fresh deploy) |
| Perp trading | Synthetic Pyth-marked perps (active) · Drift Protocol SDK (wired) |
| AI agents | Azure OpenAI GPT-4o × 3 + deterministic regime guard |
| Agent runtime | TypeScript + ts-node, Dockerized, **24/7 on an Azure VM** (15-min cycles) |
| Payments | Treasury → agent `SystemProgram::transfer` (pay.sh-style streaming) |
| Frontend | Next.js + pure CSS (hosted on Vercel) |
| Wallet | Phantom + `@solana/wallet-adapter` |
| Shares | SPL Token Program + Associated Token Accounts |
| Oracle | Pyth Solana Receiver |
| Indexing | Helius webhook (bearer-auth) + 30-second polling fallback |

---

## Smart contract instructions

| Instruction | Description | Status |
|---|---|---|
| `initialize_vault` | Creates vault PDA, sets agent authority | Live |
| `initialize_vault_with_mint` | Creates vault PDA plus $FNRX mint | Live |
| `initialize_vault_mint` | One-time live-vault migration for $FNRX | Live |
| `migrate_vault_v2` | Reallocs legacy vault for NAV ledger + executed-trade fields | Live |
| `deposit` | User sends SOL, receives proportional $FNRX, stamps inception NAV on first deposit | Live |
| `withdraw` | Burns $FNRX, returns proportional SOL | Live |
| `log_multi_agent_decision` | Stores all 3 votes + Pyth price; enforces leverage caps + confidence floor | Live |
| `log_trade` | Records individual trade execution reference | Live |
| `update_nav` | Bounded ±10% upside / −25% downside NAV write | Live |
| `record_nav_snapshot` | Creates an immutable `NavRecord` PDA | Live |
| `record_trade_outcome` | Increments `executed_trade_count` + `winning_trades` on positive PnL | Live |
| `open_synthetic_position` | Opens a synthetic perp position price-marked by Pyth | Live |
| `close_synthetic_position` | Settles the position at Pyth close price, bumps win counters | Live |
| `emergency_pause` / `resume` | Admin-only halt or resume of agent trading | Live |
| `init_agent_reputation` / `update_agent_reputation` | Dedicated `AgentReputation` PDA win-rate tracking | In source — awaits fresh deploy (current program immutable; win rate is [computed](#per-agent-reputation-computed-on-chain) meanwhile) |
| `init_vault_strategy` / `set_strategy_mode` | Vault-level strategy mode byte (Momentum / MeanRevert / RangeDCA) | In source — awaits fresh deploy (agent defaults to Momentum) |

---

## API surface

All routes are Next.js serverless functions. RPC always goes through the server so the Helius key never reaches the browser.

| Route | Purpose |
|---|---|
| `/api/rpc` | Authenticated RPC proxy + pool/rate-limit; Helius key stays server-side |
| `/api/decisions` | Decoded `MultiAgentDecision` history (cached, RPC-fallback) |
| `/api/reputation` | Per-persona win rate, computed by joining decisions to closed-position PnL |
| `/api/webhook` | Bearer-authed Helius webhook; payloads sanitized before SSE rebroadcast |

---

## Getting started

```bash
# 1. Clone (use a path without spaces; anchor build fails on Windows otherwise)
git clone https://github.com/rajanpanth/Fornex C:\fornex
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

# 4. Build and deploy the program (skip if reusing the existing devnet ID)
$env:HOME = $env:USERPROFILE   # Windows only
anchor build
anchor deploy --provider.cluster devnet

# 5. Run frontend
npm run dev -- -p 3001

# 6. (Optional) Bake one LONG and one SHORT into the on-chain history
FORNEX_FORCE_DIRECTION=LONG  FORNEX_SINGLE_CYCLE=1 npm run agent
FORNEX_FORCE_DIRECTION=SHORT FORNEX_SINGLE_CYCLE=1 npm run agent

# 7. Start the live cycle locally...
cd agent && pm2 start pm2-runner.js --name fornex-agent

# ...or run it 24/7 on the Azure VM (production)
docker build -t fornex-agent ./agent
docker run -d --name fornex-agent --restart unless-stopped \
  --env-file ./agent/.env fornex-agent
```

### Helius webhook setup

Configure in the [Helius dashboard](https://dev.helius.xyz/dashboard/app):

| Setting | Value |
|---|---|
| Account Addresses | `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf` |
| Transaction Types | `PROGRAM_INTERACTION` |
| Webhook Type | `enhanced` |
| Webhook URL | `https://fornexlab.vercel.app/api/webhook` |
| Authentication | `Bearer ${HELIUS_WEBHOOK_SECRET}` |

The endpoint rejects any POST that doesn't present the secret. Payloads are sanitized down to `{ signature, type, timestamp, programId }` before being broadcast to SSE clients, so a compromised webhook source cannot inject HTML or JS into the dashboard.

> **Note:** Vercel serverless functions don't hold persistent connections, so SSE is best-effort. The 30-second polling fallback keeps the UI fresh regardless.

---

## Roadmap

**Shipped (devnet)**
- BULL / BEAR / ZEN multi-agent brain on a 15m cycle with regime guard
- Caps enforced inside the Anchor program (3× / 2× / 2×, ±10% NAV, ≥ 60% confidence)
- `MultiAgentDecision` PDAs with full reasoning, decoded on `/proof`
- Synthetic Pyth-marked perps as a self-contained executor
- Drift execution path wired (gated via `DRIFT_SKIP_EXECUTION`)
- Pay.sh streaming micropayments on every executed trade
- Inception NAV stamped on-chain; honest win-rate from realized PnL
- **Per-agent reputation computed on-chain** from decisions + closed-position PnL (`/api/reputation`)
- 24/7 Dockerized agent on an Azure VM, auto-restart on crash/reboot
- Decision drawer with full reasoning trace, FNV-1a tamper hash, and consensus receipt
- Live `logsSubscribe` decision stream with auto-reconnect
- Risk dashboard: drawdown, high-water mark, longest losing streak, Sharpe-like ratio — all client-side from on-chain `NavRecord` history
- Public read-only `@fornex/sdk` package (`packages/sdk/`)

**Next fresh deploy (code-complete, blocked by current program immutability)**
- Dedicated `AgentReputation` PDA write path (replaces the computed fallback)
- Vault-level strategy modes (Momentum / MeanRevert / RangeDCA) gated on chain
- Strategy-mode-aware risk caps on-chain

**Mainnet plan**
- Vault-PDA CPI signing into Drift (no agent custody of trading capital)
- Squads multisig on the treasury and admin
- `@fornex/sdk` published to npm
- Depositor-defined leverage and confidence floors

---

## Known limitations (devnet prototype)

- The currently deployed program is **immutable** (no upgrade authority). New on-chain instructions require a fresh program ID, so reputation and strategy modes use computed / default fallbacks until then.
- The agent executes trades from its own keypair, not a vault-PDA CPI. NAV updates are computed off-chain from realized PnL and reported back on-chain (bounded ±10%).
- `agent_authority` is a single hot key on devnet (see [Trust Assumptions](#trust-assumptions) for the mainnet plan).
- `emergency_pause` halts trading and NAV updates but not deposits / withdrawals.
- `signals.ts` reads Drift mainnet markets read-only because devnet markets have ~0 volume; trading itself stays on devnet.
- Devnet RPC throughput is rate-limited; the production deploy uses a Helius URL via `/api/rpc`.

---

## Disclaimer

This is a **Solana devnet hackathon prototype**. It is not audited, not deployed on mainnet, and not intended for real user funds. All transactions use devnet SOL with no real monetary value. Trust assumptions and the mainnet plan are listed above.

---

<div align="center">

Built for **Solana India Cohort Capstone — 2026**

</div>
