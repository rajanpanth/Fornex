<table border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td valign="middle" width="180">
      <img src="public/fornex-logo.png" alt="Fornex Protocol" width="160" />
    </td>
    <td valign="middle">
      <h1>Fornex</h1>
      <strong>Non-custodial Solana vault run by three AI agents, with every risk cap enforced on-chain.</strong>
    </td>
  </tr>
</table>


**Autonomous, non-custodial AI trading vault on Solana.**

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)]()
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue)]()
[![AI](https://img.shields.io/badge/AI-GPT--4o-green)]()
[![Agent](https://img.shields.io/badge/Agent-24%2F7%20on%20Azure-0078D4)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

Most "AI trading" products ask you to trust a screenshot. Fornex writes every decision to the chain instead. Three LLM agents debate each trade, a majority vote decides, and the full reasoning, the consensus, the leverage caps, and the realized PnL all land on Solana where anyone can read them. The agent even gets paid per trade, on chain, from a separate treasury wallet.

| | |
|---|---|
| **Live app** | [fornexlab.vercel.app](https://fornexlab.vercel.app) |
| **For judges** | [fornexlab.vercel.app/judges](https://fornexlab.vercel.app/judges) |
| **On-chain proof** | [fornexlab.vercel.app/proof](https://fornexlab.vercel.app/proof) |
| **Source** | [github.com/rajanpanth/Fornex](https://github.com/rajanpanth/Fornex) |
| **Network** | Solana Devnet |
| **Built for** | Solana India Cohort Capstone 2026 |

## What Fornex does

Fornex is a non-custodial vault where users deposit devnet SOL and receive real $FNRX SPL vault-share tokens. A multi-agent AI system runs the vault: BULL (momentum), BEAR (contrarian), and ZEN (risk-focused tiebreaker) each read live market signals every 15 minutes and vote on direction, leverage, and confidence. A 2 of 3 majority wins, and a trade only executes when consensus confidence clears 60 percent.

Everything that matters is enforced inside the Anchor program rather than in off-chain code. Per-agent leverage caps, the confidence floor, bounded NAV writes, and single-trade PnL limits are all on chain, so the agent cannot override them even if its key is compromised. Each cycle writes a `MultiAgentDecision` account that stores all three votes with 200 bytes of prose reasoning each, the Pyth-verified SOL price, and the execution reference.

## Verify on chain

Every claim in this document resolves to an account on Solana devnet. Open any row in Solana Explorer.

| What | Address |
|---|---|
| Anchor program | [`H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf`](https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet) |
| Vault PDA (NAV, share supply, trade counters) | [`HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR`](https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet) |
| $FNRX share token mint | [`BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj`](https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet) |
| Agent wallet (executes perps) | [`2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n`](https://explorer.solana.com/address/2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n?cluster=devnet) |
| Treasury wallet (funds pay.sh stream) | [`HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat`](https://explorer.solana.com/address/HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat?cluster=devnet) |
| All decisions, decoded | [fornexlab.vercel.app/proof](https://fornexlab.vercel.app/proof) |

## Highlights

- **Multi-agent governance with on-chain caps.** BULL up to 3x, BEAR and ZEN up to 2x, consensus confidence at least 60 percent, NAV writes bounded to +10 percent / -25 percent per cycle, and single-trade PnL capped at 50 percent of NAV. All enforced in Anchor under `programs/fornex/src/instructions/`.
- **Reasoning on chain, not just price.** Every `MultiAgentDecision` account reserves 200 bytes per agent for natural-language reasoning, plus a Pyth-stamped price and confidence. The `/proof` page decodes these straight from Solana.
- **Per-agent reputation computed from realized PnL.** BULL, BEAR, and ZEN win rates are derived on chain by joining each persona's vote to the realized PnL of the position it opened. FLAT votes are excluded. No database, fully reproducible.
- **Self-contained synthetic perpetuals.** When external venues are unavailable, Fornex still trades. `open_synthetic_position` and `close_synthetic_position` mark against Pyth and bound PnL inside the program.
- **Real per-trade agent payments.** Every executed trade fires a transfer from a separate treasury keypair to the agent wallet. It is not a self-transfer, and the code refuses to fake one.
- **Honest accounting.** Win counters only increment on closed positions with realized PnL. Inception NAV is stamped on chain so depositor PnL is anchored to a real start point. Deposits never count as wins.
- **Always on.** The agent runs 24/7 in a Docker container on an Azure VM, waking every 15 minutes and restarting itself on crash or reboot.

## Product walkthrough

Each route is a distinct surface in the app. They all read the same on-chain state; the UI is shaped around the job each one does.

| Route | What it does |
|---|---|
| [`/`](https://fornexlab.vercel.app) | Landing page with a live preview of recent on-chain decisions. No wallet required. |
| [`/app`](https://fornexlab.vercel.app/app) | The vault dashboard. Connect Phantom, deposit SOL for $FNRX, withdraw, and watch the agent vote breakdown, NAV, win rate, agent reputation, and earnings update live. |
| [`/proof`](https://fornexlab.vercel.app/proof) | Every `MultiAgentDecision` account decoded directly from Solana: all three votes, reasoning, Pyth price, consensus, and execution status, with a live decision stream and a tamper hash. |
| [`/judges`](https://fornexlab.vercel.app/judges) | A single page to grade the project in 90 seconds: honest summary, dependency strip, FAQ, and a table of every on-chain account worth inspecting. |

## How it works

A depositor sends SOL to the vault and receives proportional $FNRX, minted through a Token Program CPI. On the first deposit the vault stamps its inception NAV so all future PnL is measured against a real starting point.

From there the agent runs autonomously on a 15-minute loop:

1. **Read state.** The agent reads the current vault NAV from chain and fetches live market signals (funding rate, open interest, long/short ratio, liquidation walls).
2. **Debate.** BULL, BEAR, and ZEN each vote in parallel through GPT-4o. A deterministic regime guard steps in only when all three return FLAT in a plainly one-sided market, so the dashboard never looks frozen.
3. **Decide.** A 2 of 3 majority forms the consensus. If confidence is at least 60 percent, the executor opens or closes a position.
4. **Record.** All three votes plus reasoning are written to a `MultiAgentDecision` account, Pyth-stamped with the verified SOL price.
5. **Settle.** On close, realized PnL is computed and bounded on chain, win counters update, and NAV is rewritten within its cycle bounds.
6. **Pay.** On every executed trade, the treasury wallet streams 0.001 SOL to the agent wallet as a real on-chain transfer.

The Anchor program is the only authority that can change vault state. There is no external orchestrator, no off-chain trade bus, and no centralized risk service.

```
Depositor (Phantom)
      |
      v
Vault PDA  ·  $FNRX            Pyth oracle (SOL/USD)
  shares, NAV  <------------------------+
      |                                 |
      | read NAV                        |
      v                                 |
Brain (15m cycle)   Azure VM · Docker · 24/7
BULL · BEAR · ZEN   wakes every 15 min, auto-restarts
debate + consensus
      |
      +----------------+
      v                v
MultiAgentDecision   Synthetic / Drift executor
account (proof)            |
      ^                    v
      |             SyntheticPosition (Pyth-marked PnL)
      |                    |
record_trade_outcome <-----+
      |
      v
pay.sh stream (treasury -> agent, 0.001 SOL per executed trade)
```

## The three agents

| Agent | Personality | Max leverage (on chain) | Signal focus |
|---|---|---|---|
| BULL | Momentum, squeeze | 3x | Negative funding, rising open interest, crowded shorts |
| BEAR | Contrarian | 2x | Extreme long/short ratio, positive funding, mark vs index spread |
| ZEN | Risk-focused tiebreaker | 2x | Liquidation walls, spread, regime stability |

Consensus is a 2 of 3 majority, and confidence must be at least 60 percent to execute. Both rules are enforced on chain.

### Regime guard

LLM agents are not always reliable. To keep the vault sensible in extreme regimes, `agent/src/brain.ts` ships a deterministic guard that runs only when all three agents return FLAT:

- Long/short ratio above 2.0 or funding above 0.02 percent per hour: BEAR flips to SHORT 1.5x at 60 percent confidence (mean reversion).
- Long/short ratio below 0.6 or funding below -0.02 percent per hour: BULL flips to LONG 1.5x at 60 percent confidence (squeeze thesis).
- Otherwise the unanimous FLAT stands.

This is a documented prior, not a discretionary market call.

## Per-agent reputation

The agent reputation card on `/app` shows each persona's closed-trade win rate. It is not stored in a single account; it is computed live from data that already exists on chain and served by `/api/reputation`:

- Each persona's vote direction lives in the `MultiAgentDecision` account.
- Realized PnL lives in the `SyntheticPosition` account.
- For each closed position, the route finds the decision that opened it (same direction, nearest open timestamp) and scores it with the exact rule the on-chain `update_agent_reputation` would use: FLAT is excluded, LONG with positive PnL is correct, SHORT with negative PnL is correct, and a zero-PnL trade counts toward the total but never as a win.

This keeps the metric honest and verifiable without a database, since anyone can recompute it from the same accounts.

> The dedicated `AgentReputation` account write path exists in source, but the currently deployed devnet program is immutable (it has no upgrade authority), so that account cannot be initialized against it. Computing from existing decision and position accounts makes the feature real today, with no redeploy. The dedicated path activates on the next fresh deploy.

## Executor adapters

The executor layer is pluggable. The agent selects one adapter at startup with `FORNEX_EXECUTOR`.

| Adapter | Status | Notes |
|---|---|---|
| `synthetic` (default) | Active | On-chain Pyth-marked synthetic perpetuals via `open_synthetic_position` and `close_synthetic_position`. PnL settles atomically into vault counters. |
| `drift` | Wired, inactive | Drift Protocol devnet integration. The agent's Drift sub-account is live at [`55pSF6jL`](https://explorer.solana.com/address/55pSF6jL6b5mMoiSjuMsbfD1PfJhTApLcBnPsZ3guHE2?cluster=devnet). Set `FORNEX_EXECUTOR=drift` once Drift devnet recovers. |
| `mango`, `phoenix` | Roadmap | Same interface, future adapters. |

The synthetic executor is not a mock. Every position is a real on-chain account, every price is a real Pyth reading verified in Rust, and every PnL calculation is bounded to 50 percent of NAV by the Anchor program.

### Live trades (synthetic executor)

Positions settle on a Fornex-owned account, price-marked against Pyth at open and close.

| Action | Transaction | Account |
|---|---|---|
| Open LONG (0.25 SOL collateral, 1x) | [tx](https://explorer.solana.com/tx/VkFHkwQCmsskpbBowypviXmWgU2RzdDr8aEPSaBNtAhrzcz55NLWR88abxyYrc1aiQxX9PXFyXeapovKGZKGE9i?cluster=devnet) | [account](https://explorer.solana.com/address/4HgQmJQpk2gk1yAf4iL8kLd6uG6yz8LC2GVaz4sg2sod?cluster=devnet) |
| Close LONG (realized PnL -0.000131 SOL) | [tx](https://explorer.solana.com/tx/5jhx2pFvL8Fsz44aGRWs6btiwrLbpG7MgYQSVdrvBiZ5ewzFMRJE5383tUEofHWvB1EdVDdjHwCgAnuVCarp4xeT?cluster=devnet) | same account, now closed |
| Open SHORT (0.25 SOL, 1x) | [tx](https://explorer.solana.com/tx/cggpvmoZrzyj5g8XMvXLCNgmhTjgwNzvCytkmRooGYZAHuPCZFPCj9ZzMeZno8NLU85QxZ8b4NNuGrgVhsXEQxt?cluster=devnet) | [account](https://explorer.solana.com/address/DtSxQZxSw3XwZHiDFM9MdrR72u7Bt3MLf8KxsBH7E5cg?cluster=devnet) |
| Close SHORT (realized PnL -0.000043 SOL) | [tx](https://explorer.solana.com/tx/5XYmctUzLMFntSpfsJfc8Z27gBdJorfEeX5wQqAiVcKTcJGuRqJdpEA5RYDZ9vNyiY9ibDPkR9geyqrkJUVB1LJf?cluster=devnet) | same account, now closed |
| pay.sh treasury to agent (latest) | [tx](https://explorer.solana.com/tx/2bzfMVKnGCh8KkoBuAf7oAkcNH8T5cd79UgA69zqbGNMxu6CfLQVMjMRLsV866nD5j87qxt6Agw3oVpSo6vnLaAw?cluster=devnet) | n/a |

## On-chain risk caps

Every cap below is enforced by the program, not by off-chain code.

| Cap | Value | Enforced in |
|---|---|---|
| BULL leverage | up to 3x | `validate_vote` in `log_multi_agent_decision.rs` |
| BEAR leverage | up to 2x | same |
| ZEN leverage | up to 2x | same |
| Consensus confidence floor | at least 60 percent when executing | `log_multi_agent_decision.rs` |
| NAV write change | +10 percent / -25 percent per cycle | `update_nav.rs` |
| Realized PnL per trade | up to 50 percent of NAV | `record_trade_outcome.rs`, `close_synthetic_position.rs` |
| Win-rate basis | derived from `executed_trade_count`, not deposits | `record_trade_outcome.rs` |

## Trust assumptions

| Authority | Can do | Cannot do |
|---|---|---|
| User wallet | Deposit and withdraw their own shares | Anything else |
| Vault PDA | Mint and burn $FNRX, custody SOL | Sign agent or admin operations |
| Agent (hot key, devnet) | Log decisions, bounded NAV updates, NAV snapshots, bounded trade outcomes, open and close synthetic positions | Move user funds, override leverage caps, change admin |
| Admin (hot key, devnet) | Emergency pause and resume, vault migration, vault initialization | Trade, change `agent_authority` (set once at init) |
| Treasury (hot key, devnet) | Fund pay.sh micropayments to the agent wallet | Anything else on chain related to the vault |

**Mainnet plan.** Move `admin` to a Squads multisig, hold `agent_authority` inside a Phala or AWS Nitro enclave with attestation-based provisioning, and replace direct NAV discretion with realized-PnL CPI from a vault-owned Drift account.

### Treasury safety

The treasury wallet that funds the pay.sh stream is a separate keypair from the agent, so a hot-key compromise has a bounded blast radius.

| Layer | Devnet | Mainnet plan |
|---|---|---|
| Source of funds | Solana faucet | Squads multisig vault |
| Spender (signs each pay.sh tx) | `FORNEX_TREASURY_KEYPAIR` (hot) | Same hot keypair, budgeted |
| Top-up cadence | Manual | Scheduled `vault_transaction`, for example 1 SOL per month |
| Compromise radius | Whatever is in the keypair | Residual budget only, never the multisig vault |

Set `FORNEX_TREASURY_SOURCE=squads:<MULTISIG_PUBKEY>` and the agent surfaces the provenance in its logs and on the `/judges` page. Squads orchestration of the top-up is an operational task scheduled outside Fornex; the marker is provenance, not on-chain enforcement.

## Always-on agent

The agent is a self-contained TypeScript runtime that runs continuously, not on demand and not on a laptop.

| Aspect | Detail |
|---|---|
| Host | Azure Virtual Machine (Linux) |
| Packaging | Docker (`agent/Dockerfile`, `node:20-bookworm-slim`), agent directory only |
| Supervision | Container runs with `--restart unless-stopped`; `pm2-runner.js` boots ts-node and the entrypoint |
| Cadence | One full cycle every 15 minutes |
| Inbound traffic | None. The agent has no HTTP server; it only reads signals and writes to Solana |
| Crash and reboot | Comes back up automatically; the loop is idempotent and re-reads chain state each cycle |

```bash
# On the Azure VM
docker build -t fornex-agent ./agent
docker run -d --name fornex-agent --restart unless-stopped \
  --env-file ./agent/.env fornex-agent
```

The frontend is hosted separately on Vercel. Only the autonomous agent runs on the Azure VM.

## Stack

- [Anchor](https://www.anchor-lang.com) (Rust) for the on-chain program
- [Next.js](https://nextjs.org) with pure CSS for the frontend, hosted on [Vercel](https://vercel.com)
- TypeScript and ts-node for the agent runtime, Dockerized on an Azure VM
- [Azure OpenAI](https://azure.microsoft.com/products/ai-services/openai-service) GPT-4o for the three agents
- [Pyth](https://pyth.network) Solana Receiver for SOL/USD price verification
- [SPL Token Program](https://spl.solana.com/token) for $FNRX vault shares
- [`@solana/wallet-adapter`](https://github.com/anza-xyz/wallet-adapter) with Phantom
- [Helius](https://helius.dev) webhooks (bearer-authed) plus 30-second polling for indexing
- [Drift Protocol SDK](https://drift-labs.github.io/v2-teacher/) for the wired Drift executor

## Smart contract instructions

| Instruction | Description | Status |
|---|---|---|
| `initialize_vault` | Creates the vault account and sets the agent authority | Live |
| `initialize_vault_with_mint` | Creates the vault account plus the $FNRX mint | Live |
| `initialize_vault_mint` | One-time live-vault migration for $FNRX | Live |
| `migrate_vault_v2` | Reallocs the legacy vault for the NAV ledger and executed-trade fields | Live |
| `deposit` | Sends SOL, mints proportional $FNRX, stamps inception NAV on first deposit | Live |
| `withdraw` | Burns $FNRX, returns proportional SOL | Live |
| `log_multi_agent_decision` | Stores all three votes plus Pyth price, enforces leverage caps and the confidence floor | Live |
| `log_trade` | Records an individual trade execution reference | Live |
| `update_nav` | Bounded +10 percent / -25 percent NAV write | Live |
| `record_nav_snapshot` | Creates an immutable `NavRecord` account | Live |
| `record_trade_outcome` | Increments executed-trade and winning-trade counters on positive PnL | Live |
| `open_synthetic_position` | Opens a synthetic perpetual position price-marked by Pyth | Live |
| `close_synthetic_position` | Settles the position at the Pyth close price and updates win counters | Live |
| `emergency_pause`, `resume` | Admin-only halt or resume of agent trading | Live |
| `init_agent_reputation`, `update_agent_reputation` | Dedicated reputation account win-rate tracking | In source, awaits a fresh deploy (current program immutable; reputation is computed meanwhile) |
| `init_vault_strategy`, `set_strategy_mode` | Vault-level strategy mode (Momentum, MeanRevert, RangeDCA) | In source, awaits a fresh deploy (agent defaults to Momentum) |

## API routes

All routes are Next.js serverless functions. RPC always goes through the server so the Helius key never reaches the browser.

| Route | Purpose |
|---|---|
| `/api/rpc` | Authenticated RPC proxy with pooling and rate limiting |
| `/api/decisions` | Decoded `MultiAgentDecision` history, cached with an RPC fallback |
| `/api/reputation` | Per-persona win rate, computed by joining decisions to closed-position PnL |
| `/api/webhook` | Bearer-authed Helius webhook; payloads sanitized before SSE rebroadcast |

## On-chain proof

Every cycle creates a new `MultiAgentDecision` account. Browse them all, decoded, at [fornexlab.vercel.app/proof](https://fornexlab.vercel.app/proof). Each account stores:

- BULL, BEAR, and ZEN votes (direction, leverage, confidence, and 200 bytes of reasoning each)
- The consensus vote
- Pyth-verified SOL price and confidence
- Execution status and transaction reference
- Timestamp

NAV snapshots live in standalone `NavRecord` accounts, so the equity curve and risk metrics rebuild directly from chain history with no database.

## Getting started

### Prerequisites

- Node 20 or later
- A Solana wallet that supports devnet (Phantom recommended)
- Devnet SOL for the agent and treasury wallets (request from the Solana faucet)
- An Azure OpenAI deployment of GPT-4o
- A Helius API key for production-grade RPC

### Run locally

```bash
# Clone (use a path without spaces; anchor build fails on Windows otherwise)
git clone https://github.com/rajanpanth/Fornex C:\fornex
cd C:\fornex

# Install dependencies
npm install
cd agent && npm install && cd ..

# Configure environment
cp .env.local.example .env.local
cp agent/.env.example agent/.env
# Fill in AGENT_KEYPAIR, FORNEX_TREASURY_KEYPAIR, AZURE_OPENAI_*,
# HELIUS_RPC_URL (server-only), and HELIUS_WEBHOOK_SECRET (server-only)

# Build and deploy the program (skip if reusing the existing devnet ID)
$env:HOME = $env:USERPROFILE   # Windows only
anchor build
anchor deploy --provider.cluster devnet

# Run the frontend
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001).

### Validation and tests

Frontend checks can be run on Windows, macOS, Linux, or WSL:

```bash
npm run typecheck
npm run lint
npm run build
```

Anchor/Solana SBF validation should be run from Linux or WSL2:

```bash
npm test
```

Native Windows can fail before Fornex tests execute with a Solana SBF/Rust path
error under `target\sbf-solana-solana` while compiling `serde_core`. That is a
local toolchain limitation, not a green or skipped Anchor result. See
[`TESTING.md`](./TESTING.md) for the exact failure mode and recommended WSL2
flow.

### Run the agent

```bash
# Optional: bake one LONG and one SHORT into the on-chain history
FORNEX_FORCE_DIRECTION=LONG  FORNEX_SINGLE_CYCLE=1 npm run agent
FORNEX_FORCE_DIRECTION=SHORT FORNEX_SINGLE_CYCLE=1 npm run agent

# Run the live 15-minute cycle locally
cd agent && pm2 start pm2-runner.js --name fornex-agent

# Or run it 24/7 on the Azure VM (production)
docker build -t fornex-agent ./agent
docker run -d --name fornex-agent --restart unless-stopped \
  --env-file ./agent/.env fornex-agent
```

### Helius webhook setup

Configure in the [Helius dashboard](https://dev.helius.xyz/dashboard/app).

| Setting | Value |
|---|---|
| Account addresses | `H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf` |
| Transaction types | `PROGRAM_INTERACTION` |
| Webhook type | `enhanced` |
| Webhook URL | `https://fornexlab.vercel.app/api/webhook` |
| Authentication | `Bearer ${HELIUS_WEBHOOK_SECRET}` |

The endpoint rejects any POST that does not present the secret. Payloads are sanitized down to signature, type, timestamp, and program id before broadcast, so a compromised webhook source cannot inject HTML or JS into the dashboard. Vercel serverless functions do not hold persistent connections, so SSE is best-effort and the 30-second polling fallback keeps the UI fresh regardless.

## Roadmap

**Shipped on devnet**

- BULL, BEAR, and ZEN multi-agent brain on a 15-minute cycle with a regime guard
- Caps enforced inside the Anchor program (3x / 2x / 2x leverage, bounded NAV, 60 percent confidence floor)
- `MultiAgentDecision` accounts with full reasoning, decoded on `/proof`
- Synthetic Pyth-marked perpetuals as a self-contained executor
- Drift execution path wired and gated via `DRIFT_SKIP_EXECUTION`
- pay.sh streaming micropayments on every executed trade
- Inception NAV stamped on chain and honest win rate from realized PnL
- Per-agent reputation computed on chain from decisions and closed-position PnL
- The agent runs 24/7 under PM2 on an Azure VM, waking every 15 minutes and auto-restarting on crash or reboot.
- Decision drawer with full reasoning trace, tamper hash, and consensus receipt
- Live decision stream with auto-reconnect, and a risk dashboard rebuilt client-side from `NavRecord` history
- Public read-only `@fornex/sdk` package

**Next fresh deploy (code complete, blocked by current program immutability)**

- Dedicated `AgentReputation` account write path, replacing the computed fallback
- Vault-level strategy modes gated on chain
- Strategy-mode-aware risk caps on chain

**Mainnet plan**

- Vault-PDA CPI signing into Drift, so the agent never custodies trading capital
- Squads multisig on the treasury and admin
- `@fornex/sdk` published to npm
- Depositor-defined leverage and confidence floors

## Known limitations

This is a devnet prototype.

- The currently deployed program is immutable (no upgrade authority). New on-chain instructions require a fresh program id, so reputation and strategy modes use computed or default fallbacks until then.
- The agent executes trades from its own keypair, not a vault-PDA CPI. NAV updates are computed off chain from realized PnL and reported back on chain within bounds.
- `agent_authority` is a single hot key on devnet. The mainnet plan moves it into an enclave.
- `emergency_pause` halts trading and NAV updates but not deposits or withdrawals.
- `signals.ts` reads Drift mainnet markets read-only because devnet markets have near-zero volume. Trading itself stays on devnet.
- Devnet RPC throughput is rate-limited. The production deploy uses a Helius URL via `/api/rpc`.

## License

MIT.
