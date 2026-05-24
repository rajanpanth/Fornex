# Fornex Protocol

> Autonomous 3-agent AI trading vault where every decision
> is permanently stored on Solana. The world's first
> auditable AI hedge fund on-chain.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)]()
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue)]()
[![GPT-4o](https://img.shields.io/badge/AI-GPT--4o-green)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

## 🔴 Live on Solana Devnet

| Resource | Link |
|---|---|
| Program | https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet |
| Vault | https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet |
| Agent Running Since | May 24, 2026 |
| Decisions On-Chain | 25 (growing every 15 min) |

## Screenshots

![Debate Feed](docs/screenshots/debate-feed.png)
![Solana Explorer Decision Account](docs/screenshots/explorer-decision.png)
![Agent Terminal Output](docs/screenshots/agent-terminal.png)
![Vault Stats](docs/screenshots/vault-stats.png)

## The Problem

Current DeFi vaults are black boxes. You deposit and hope.
No transparency into what AI is doing. No way to verify.
No auditability. Pure trust.

## The Solution

Fornex deploys three competing AI agents that debate every
perp trade on Drift Protocol. Every vote, every argument,
every disagreement — stored permanently on Solana.
Not in a database. On-chain. Forever. Verifiable by anyone.

## How It Works

```
User deposits SOL -> receives vault shares
         |
Every 15 minutes (autonomous, no human needed):
         |
+-------------------------------------+
|  BULL 🐂  reads: funding rate, OI   |
|  BEAR 🐻  reads: L/S ratio, spread  |  -> 3 votes
|  ZEN  ⚖️   reads: liq walls, vol    |
+-------------------------------------+
         |
Majority vote -> executes on Drift Protocol
         |
ALL 3 votes + reasoning -> stored on Solana forever
         |
Agent earns 0.001 SOL via pay.sh per trade
         |
NAV updates -> share price changes -> user P&L changes
```

## The Three Agents

| Agent | Personality | Max Leverage | Signal Focus |
|---|---|---|---|
| 🐂 BULL | Momentum trader | 3x | Negative funding, rising OI |
| 🐻 BEAR | Contrarian | 2x | Extreme L/S ratio, overbought |
| ⚖️ ZEN | Risk manager | 1.5x | Liquidation walls, vol, spread |

**Consensus: 2/3 majority wins. Confidence > 65% to execute.**

## Technical Stack

| Layer | Technology |
|---|---|
| Smart Contract | Anchor (Rust) — 7 instructions |
| Perp Trading | Drift Protocol SDK (devnet) |
| AI Agents | Azure OpenAI GPT-4o |
| Agent Loop | TypeScript + pm2 (15-min cycles) |
| Payments | pay.sh streaming micropayments |
| Frontend | Next.js + pure CSS |
| Wallet | Phantom + @solana/wallet-adapter |

## Architecture

```
+-------------+     +------------------+     +---------------+
|    USER     |---->|  ANCHOR VAULT    |---->|  DRIFT PERPS  |
|  (Phantom)  |     |  (Solana Devnet) |     |   (devnet)    |
+-------------+     +------------------+     +---------------+
                              |
                    +---------v--------+
                    |   AI AGENT       |
                    |   (pm2, 15 min)  |
                    |                  |
                    |  signals.ts      |
                    |  brain.ts (x3)   |
                    |  executor.ts     |
                    |  logger.ts       |
                    |  paysh.ts        |
                    +---------+--------+
                              |
                    +---------v--------+
                    | MultiAgentDecision|
                    | accounts on-chain |
                    | (permanent, public)|
                    +---------+--------+
                              |
                    +---------v--------+
                    |  NEXT.JS FRONTEND |
                    |  reads chain live |
                    |  localhost:3001   |
                    +------------------+
```

## Smart Contract Instructions

| Instruction | Description |
|---|---|
| initialize_vault | Creates vault PDA, sets agent authority |
| deposit | User sends SOL, receives proportional shares |
| withdraw | Burns shares, returns proportional SOL |
| log_multi_agent_decision | Stores all 3 votes on-chain permanently |
| update_nav | Updates vault value after trade settles |
| emergency_pause | Halts agent trading (safety switch) |
| resume | Restarts agent trading after pause |

## Getting Started

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/fornex-protocol
cd fornex-protocol

# 2. Install dependencies
npm install
cd agent && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Set up environment
cp agent/.env.example agent/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in your values

# 4. Run frontend
npm run dev -- -p 3001

# 5. Start agent
cd agent && pm2 start "npx ts-node src/index.ts" --name fornex-agent

# 6. View live
open http://localhost:3001
```

## On-Chain Proof

Every 15 minutes, a new MultiAgentDecision account is
created on Solana. You can verify any decision at:

https://explorer.solana.com/address/26xK7W7tRkrXNebaBwW9cSD7NG2L1G9udepr7gi6c9Qp?cluster=devnet

The account stores:
- BULL vote (direction + leverage + confidence + reasoning)
- BEAR vote (direction + leverage + confidence + reasoning)
- ZEN vote (direction + leverage + confidence + reasoning)
- Consensus decision
- Execution status
- Timestamp

**This data is permanent. Immutable. Trustless.**

## Demo Proof Transactions

| Action | Transaction |
|---|---|
| Deposit 0.5 SOL | https://solscan.io/tx/4AQNwfbUs1Z3cbo7VLreCeLgrrh1r7PnCzoKQzYQoL97JgQiQw4TWeiHpJsjvy6roAwq9F4BSqdukfsEcBsZRvRj?cluster=devnet |
| Withdraw SOL | https://solscan.io/tx/4bfNiVKpZFKAzYvNmkUbbF2xzPGQKsq8faUqsKMFjbz6VzN2ef1qNFWMZahP3ScHQ7sropae9DfLcj5khVcbtwR1?cluster=devnet |

---

Built for Solana India Cohort Capstone — May 2026
