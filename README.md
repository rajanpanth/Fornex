<p align="center">
  <img src="https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white" />
  <img src="https://img.shields.io/badge/Anchor-0.30-23C4ED?style=for-the-badge&logo=anchor&logoColor=white" />
  <img src="https://img.shields.io/badge/GPT--4o-Azure_OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Drift_Protocol-Perps-1DE9B6?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" />
</p>

<h1 align="center">🏛️ Fornex Protocol</h1>

<p align="center">
  <strong>The world's first auditable AI hedge fund on Solana.</strong>
  <br />
  <em>Three AI agents debate every trade. Every vote and reasoning is stored permanently on-chain.</em>
  <br /><br />
  <code>Program ID: G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw</code>
</p>

---

## 🔴 The Problem

**AI trading is a black box.**

Users deposit capital into AI-managed funds — and that's where transparency ends. The agent makes decisions off-chain, executes trades nobody can verify, and there's zero accountability for *why* a position was opened or closed.

> *"Trust me, bro"* is not a trading strategy.

There is no on-chain record of the AI's reasoning. No audit trail. No way for depositors to verify whether the agent is acting rationally — or gambling their SOL.

---

## 🟢 The Solution

**Fornex makes every AI decision auditable, transparent, and permanently on-chain.**

Three specialized AI agents — each with a distinct trading personality — independently analyze Drift Protocol perpetual markets every 15 minutes. They vote on direction, leverage, and confidence. A 2/3 consensus is required to execute. Every vote, every reasoning string, and every trade outcome is written to Solana as a permanent, publicly readable account.

Depositors don't need to trust the agent. They can **verify** it.

---

## ⚙️ How It Works

```
  ╔═══════════════════════════════════════════════════════════════════════╗
  ║                        FORNEX PROTOCOL FLOW                         ║
  ╠═══════════════════════════════════════════════════════════════════════╣
  ║                                                                     ║
  ║   👤 User                                                           ║
  ║    │                                                                ║
  ║    │  deposit SOL                                                   ║
  ║    ▼                                                                ║
  ║   ┌─────────────────────────────────────┐                           ║
  ║   │   Fornex Anchor Vault Program       │  ← Solana Devnet         ║
  ║   │   • mint shares (deposit)           │                           ║
  ║   │   • burn shares (withdraw)          │                           ║
  ║   │   • store NAV + trade count         │                           ║
  ║   └──────────────┬──────────────────────┘                           ║
  ║                  │                                                  ║
  ║          every 15 minutes                                           ║
  ║                  │                                                  ║
  ║   ┌──────────────▼──────────────────────┐                           ║
  ║   │   🤖 AI Agent Loop (index.ts)       │                           ║
  ║   │                                     │                           ║
  ║   │   ① signals.ts → Drift Protocol API │  5 market signals        ║
  ║   │   ② brain.ts   → GPT-4o × 3 agents │  parallel voting         ║
  ║   │   ③ executor.ts→ Drift SDK perps    │  consensus execution     ║
  ║   │   ④ logger.ts  → Solana on-chain    │  permanent audit trail   ║
  ║   │   ⑤ paysh.ts   → pay.sh streaming   │  0.001 SOL per trade     ║
  ║   └──────────────┬──────────────────────┘                           ║
  ║                  │                                                  ║
  ║                  ▼                                                  ║
  ║   ┌─────────────────────────────────────┐                           ║
  ║   │   📊 Next.js Dashboard              │                           ║
  ║   │   • vault NAV + share price         │                           ║
  ║   │   • live agent reasoning feed       │                           ║
  ║   │   • equity curve (recharts)         │                           ║
  ║   │   • deposit / withdraw controls     │                           ║
  ║   └─────────────────────────────────────┘                           ║
  ║                                                                     ║
  ╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 🧠 Agent Personalities

Fornex runs **three AI agents** in parallel, each powered by **Azure OpenAI GPT-4o**. They receive the same market data but analyze it through fundamentally different lenses:

| Agent | Role | Personality | Max Leverage | Bias |
|:---:|:---|:---|:---:|:---:|
| 🐂 **BULL** | Momentum Trader | Favors LONG setups when funding is negative (shorts overcrowded), OI is rising (new money entering), and the long/short ratio is below 1.2 (not yet crowded). Decisive — sitting flat costs opportunity. | **3×** | LONG |
| 🐻 **BEAR** | Contrarian Trader | Fades crowded longs, watches positive funding (longs overextended), and prefers SHORT or FLAT when L/S ratio exceeds 1.6 or mark/index spread is stretched. Protects capital first. | **2×** | SHORT |
| ⚖️ **ZEN** | Risk Manager | Only trades when risk/reward is clearly favorable. Requires tight spread, low volatility, and clear liquidation walls. Prefers FLAT unless the setup is pristine. Capital preservation is the top priority. | **1.5×** | FLAT |

### Consensus Engine

```
  ┌─────────┐   ┌─────────┐   ┌─────────┐
  │  🐂 BULL │   │  🐻 BEAR │   │  ⚖️ ZEN  │
  │  LONG 2x │   │ SHORT 2x │   │  LONG 1x │
  │  conf: 78 │   │  conf: 62 │   │  conf: 71 │
  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
        │               │               │
        └───────────┬───┘───────────────┘
                    ▼
          ┌─────────────────┐
          │  2/3 CONSENSUS  │
          │   LONG  1.5x    │
          │   conf: 70      │
          │ → EXECUTE TRADE │
          └─────────────────┘
```

- **Direction**: majority wins (≥2 of 3 agents must agree)
- **Leverage**: average of agreeing agents, capped at **3×**
- **Execution**: only when consensus direction ≠ FLAT **and** confidence > **65**
- If no majority → defaults to **FLAT** (no trade)

---

## 🛠️ Technical Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Smart Contract** | Solana + Anchor (Rust) | Vault deposits, withdrawals, share accounting, on-chain decision logs |
| **Perp Trading** | Drift Protocol SDK (devnet) | SOL-PERP market signals & order execution |
| **AI Reasoning** | Azure OpenAI GPT-4o | Multi-agent analysis with structured JSON output |
| **Payments** | pay.sh | Streaming micropayments — 0.001 SOL per executed trade |
| **Frontend** | Next.js + @solana/wallet-adapter | Dashboard with wallet connect, deposit/withdraw, reasoning feed |
| **Charts** | Recharts | Equity curve visualization |
| **Testing** | Mocha + Chai + ts-mocha | Anchor integration tests |

---

## 📜 Smart Contract

The Anchor program (`programs/fornex/src/lib.rs`) exposes **6 instructions**:

| Instruction | Caller | Description |
|:---|:---:|:---|
| `initialize_vault` | Admin | Creates the vault, sets the AI agent's authority pubkey |
| `deposit` | User | Transfers SOL into the vault, mints proportional shares |
| `withdraw` | User | Burns shares, returns proportional SOL to the user |
| `log_trade` | Agent | Logs a single trade decision with reasoning (512 bytes on-chain) |
| `log_multi_agent_decision` | Agent | Logs all 3 agent votes + consensus with reasoning (the audit trail) |
| `update_nav` | Agent | Updates the vault's Net Asset Value after trades settle |

### 📐 Share Math

```
  ╔═══════════════════════════════════════════════════════════╗
  ║                    SHARE CALCULATION                     ║
  ╠═══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  First deposit:                                          ║
  ║    shares = deposit_lamports                             ║
  ║                                                          ║
  ║  Subsequent deposits:                                    ║
  ║    shares = deposit_lamports × total_shares / nav        ║
  ║                                                          ║
  ║  Withdrawal:                                             ║
  ║    sol_out = shares_to_burn × nav / total_shares         ║
  ║                                                          ║
  ╚═══════════════════════════════════════════════════════════╝
```

### On-Chain Account Layout

| Account | Key Fields | Size |
|:---|:---|:---:|
| **Vault** | `agent_authority`, `admin`, `total_deposits`, `total_shares`, `nav`, `trade_count`, `winning_trades`, `is_trading_paused` | ~113 B |
| **UserDeposit** | `owner`, `vault`, `shares`, `total_deposited`, `deposited_at` | ~89 B |
| **TradeLog** | `market [u8;16]`, `direction`, `confidence`, `reasoning [u8;512]`, `pnl_lamports` | ~582 B |
| **MultiAgentDecision** | `bull_vote`, `bear_vote`, `zen_vote`, `consensus` (each with `reasoning [u8;200]`), `execution_ref [u8;88]` | ~986 B |

---

## 🤖 AI Decision Engine

### Signal Pipeline (`signals.ts`)

Every 15 minutes, the agent fetches **5 real-time signals** from Drift Protocol's SOL-PERP market:

| # | Signal | What It Measures |
|:---:|:---|:---|
| 1 | **Funding Rate** | Whether longs or shorts are overcrowded (% per hour) |
| 2 | **Open Interest Change** | New money entering/exiting the market (% change) |
| 3 | **Long/Short Ratio** | Directional crowding — longs vs shorts |
| 4 | **Mark vs Index Spread** | Price deviation from oracle — how stretched is the market |
| 5 | **Liquidation Wall** | Nearest price level with concentrated liquidation risk |

### Decision Flow

```
  ┌────────────────────┐
  │  Drift Protocol    │
  │  SOL-PERP Market   │
  └────────┬───────────┘
           │  5 signals
           ▼
  ┌────────────────────┐      ┌──────────────────────────────┐
  │  signals.ts        │─────▶│  brain.ts                    │
  │  fetch & normalize │      │  ┌──────┐┌──────┐┌──────┐   │
  └────────────────────┘      │  │ BULL ││ BEAR ││ ZEN  │   │
                              │  │GPT-4o││GPT-4o││GPT-4o│   │
                              │  └──┬───┘└──┬───┘└──┬───┘   │
                              │     └───┬───┘───────┘       │
                              │         ▼                    │
                              │  ┌──────────────┐           │
                              │  │  Consensus   │           │
                              │  │  2/3 majority│           │
                              │  └──────┬───────┘           │
                              └─────────┼───────────────────┘
                                        │
                         ┌──────────────┼──────────────┐
                         ▼              ▼              ▼
                  ┌────────────┐ ┌────────────┐ ┌────────────┐
                  │executor.ts │ │ logger.ts  │ │  paysh.ts  │
                  │Drift SDK   │ │on-chain log│ │0.001 SOL   │
                  │place order │ │vote+reason │ │per trade   │
                  └────────────┘ └────────────┘ └────────────┘
```

---

## 🖥️ Live Demo

The **Next.js dashboard** reads directly from Solana and displays:

| Feature | Description |
|:---|:---|
| 💰 **Vault Stats** | NAV, total shares, share price, trade count, win rate |
| 🧠 **Agent Reasoning Feed** | Live BULL / BEAR / ZEN votes with reasoning strings |
| 📈 **Equity Curve** | Historical NAV performance plotted with Recharts |
| 🔐 **Deposit / Withdraw** | Wallet-connected controls via `@solana/wallet-adapter` |
| 💸 **Agent Earnings** | pay.sh streaming stats — trades per day, total earned |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Rust** + **Anchor CLI** ≥ 0.30
- **Solana CLI** (configured for devnet)
- An **Azure OpenAI** API key with a GPT-4o deployment

### 1. Clone & Install

```bash
git clone https://github.com/your-username/fornex.git
cd fornex
npm install
```

### 2. Build the Anchor Program

```bash
anchor build
```

> 💡 On Windows, use `anchor build --no-idl` if IDL generation fails.

### 3. Run Tests

```bash
anchor test
```

### 4. Deploy to Devnet

```bash
solana config set --url devnet
anchor deploy
```

### 5. Configure & Run the AI Agent

```bash
cp agent/.env.example agent/.env
# Edit agent/.env with your keys:
#   AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
#   AZURE_OPENAI_KEY=your-key
#   AZURE_OPENAI_DEPLOYMENT=gpt-4o
#   AGENT_KEYPAIR=your-base58-secret-key
#   VAULT_ADDRESS=your-vault-address
#   VAULT_PROGRAM_ID=G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw

npm run agent
```

### 6. Launch the Dashboard

```bash
cp .env.local.example .env.local
# Edit .env.local with your RPC URL and program ID

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

---

## 🏗️ Architecture

```
  ╔════════════════════════════════════════════════════════════════════════╗
  ║                        FORNEX ARCHITECTURE                           ║
  ╠════════════════════════════════════════════════════════════════════════╣
  ║                                                                      ║
  ║   ┌──────────────┐          ┌──────────────────────────────────────┐  ║
  ║   │  User Wallet │          │         Solana Devnet                │  ║
  ║   │  (Phantom,   │          │                                      │  ║
  ║   │   Solflare)  │          │  ┌────────────────────────────────┐  │  ║
  ║   └──────┬───────┘          │  │  Fornex Anchor Program         │  │  ║
  ║          │                  │  │  ┌─────────┐ ┌──────────────┐  │  │  ║
  ║          │ deposit/withdraw │  │  │  Vault  │ │ UserDeposit  │  │  │  ║
  ║          └─────────────────▶│  │  └─────────┘ └──────────────┘  │  │  ║
  ║                             │  │  ┌─────────┐ ┌──────────────┐  │  │  ║
  ║                             │  │  │TradeLog │ │MultiAgentDec │  │  │  ║
  ║                             │  │  └─────────┘ └──────────────┘  │  │  ║
  ║                             │  └────────────────────────────────┘  │  ║
  ║                             └──────────────────────────────────────┘  ║
  ║                                         ▲                            ║
  ║                                         │  log decisions + NAV       ║
  ║                                         │                            ║
  ║   ┌─────────────────────────────────────┴──────────────────────────┐  ║
  ║   │                    AI AGENT (Off-Chain)                        │  ║
  ║   │                                                                │  ║
  ║   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  ║
  ║   │  │signals.ts│  │ brain.ts │  │executor.ts│  │logger.ts │      │  ║
  ║   │  │ 5 Drift  │→ │ 3×GPT-4o│→ │ Drift SDK│  │ on-chain │      │  ║
  ║   │  │ signals  │  │consensus │  │  trades  │  │  writes  │      │  ║
  ║   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │  ║
  ║   │                                                                │  ║
  ║   │  ┌──────────┐  ┌──────────┐                                   │  ║
  ║   │  │ paysh.ts │  │ index.ts │  ← 15-minute loop                 │  ║
  ║   │  │streaming │  │main entry│                                   │  ║
  ║   │  └──────────┘  └──────────┘                                   │  ║
  ║   └────────────────────────────────────────────────────────────────┘  ║
  ║                                         │                            ║
  ║                               reads chain directly                   ║
  ║                                         │                            ║
  ║   ┌─────────────────────────────────────▼──────────────────────────┐  ║
  ║   │                    NEXT.JS DASHBOARD                           │  ║
  ║   │   wallet-adapter · vault stats · reasoning feed · recharts    │  ║
  ║   └────────────────────────────────────────────────────────────────┘  ║
  ║                                                                      ║
  ╚════════════════════════════════════════════════════════════════════════╝
```

---

## 📁 Project Structure

```
fornex/
├── programs/
│   └── fornex/
│       └── src/
│           ├── lib.rs              # Anchor program entry — 6 instructions
│           ├── state.rs            # Vault, UserDeposit, TradeLog, MultiAgentDecision
│           ├── errors.rs           # Custom error codes
│           └── instructions/       # Handler modules for each instruction
│
├── agent/
│   ├── .env.example                # Environment variable template
│   └── src/
│       ├── index.ts                # 15-minute main loop — orchestrates everything
│       ├── signals.ts              # 5 Drift Protocol signals (funding, OI, L/S, spread, liq)
│       ├── brain.ts                # 3 GPT-4o agents (BULL, BEAR, ZEN) + consensus engine
│       ├── executor.ts             # Drift SDK — open/close SOL-PERP positions
│       ├── logger.ts               # On-chain decision logging via raw Anchor instructions
│       ├── paysh.ts                # pay.sh streaming micropayments (0.001 SOL/trade)
│       ├── config.ts               # RPC, program ID, keypair loading, constants
│       └── types.ts                # TypeScript interfaces — Direction, AgentVote, Consensus
│
├── pages/
│   ├── _app.tsx                    # Next.js app wrapper with wallet providers
│   └── index.tsx                   # Dashboard — vault stats, reasoning feed, equity curve
│
├── frontend/
│   └── .env.local.example          # Frontend environment template
│
├── tests/
│   └── fornex.ts                   # Anchor integration tests
│
├── Anchor.toml                     # Anchor workspace config
├── Cargo.toml                      # Rust workspace
├── package.json                    # Node dependencies + scripts
├── tsconfig.json                   # TypeScript config
└── README.md                       # ← You are here
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built for the hackathon. Built for transparency. Built on Solana.</strong>
  <br /><br />
  <em>Every trade has a reason. Every reason is on-chain. Every agent is accountable.</em>
</p>
