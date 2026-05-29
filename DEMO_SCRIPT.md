# Fornex Protocol — Demo Script (v0.4)

This script covers every primitive the protocol ships: BULL/BEAR/ZEN debate,
on-chain caps, synthetic Pyth-marked perps, pay.sh streaming, per-agent
reputation, vault-level strategy modes, the live decision drawer, the live
WebSocket stream, the risk dashboard, and the read-only `@fornex/sdk`.

> Devnet only. No real funds.

---

## Pre-demo preparation (do once, ~5 minutes)

The Synthetic executor is on-chain and self-contained — no external dex
bootstrap required. Bake at least one LONG and one SHORT into history so
the dashboard shows real executed cards, the reputation tile has data,
and the risk dashboard has ≥2 NAV records to compute drawdown.

```bash
# 1. Wallets funded on devnet
solana airdrop 3 2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n   --url devnet
solana airdrop 1 HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat   --url devnet

# 2. Initialize the Phase B PDAs (idempotent — skips if they already exist)
npx ts-node agent/scripts/init-phase-b.ts

# 3. Force one LONG round-trip
FORNEX_FORCE_DIRECTION=LONG  FORNEX_SINGLE_CYCLE=1 npm run agent
FORNEX_FORCE_CLOSE=1          FORNEX_SINGLE_CYCLE=1 npm run agent

# 4. Force one SHORT round-trip
FORNEX_FORCE_DIRECTION=SHORT FORNEX_SINGLE_CYCLE=1 npm run agent
FORNEX_FORCE_CLOSE=1          FORNEX_SINGLE_CYCLE=1 npm run agent

# 5. Pin the resulting tx ids in README's "Live Trades" table
```

Each cycle writes:
- A `MultiAgentDecision` PDA (BULL/BEAR/ZEN votes + Pyth price)
- A `SyntheticPosition` PDA (open) or settles one (close)
- A `NavRecord` PDA on close (NAV snapshot with realized PnL)
- An `AgentReputation` update (per-persona win rate)
- A real treasury → agent SOL transfer (pay.sh stream)

`FORNEX_FORCE_DIRECTION` only forces *direction*; the AI vote breakdown is
real. `FORNEX_FORCE_CLOSE=1` forces a close on the next cycle — the on-chain
history is still genuine.

### Live agent state

| Account | Pubkey |
|---|---|
| Vault PDA | `HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR` |
| Agent wallet | `2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n` |
| Treasury wallet (funds pay.sh stream) | `HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat` |
| AgentReputation PDA | derived: `["agent_reputation", VAULT]` |
| VaultStrategy PDA | derived: `["vault_strategy", VAULT]` |
| Inception NAV (on-chain) | 5.001 SOL |

### Switching to Drift (when devnet recovers)

```bash
# Once https://app.drift.trade?network=devnet is online again:
FORNEX_EXECUTOR=drift DRIFT_SKIP_EXECUTION=0 npm run agent
```

### Switching strategy modes

```bash
# After init-phase-b initialized VaultStrategy at mode 0 (Momentum):
#   - mode 1 = MeanRevert
#   - mode 2 = RangeDCA
# Re-running init-phase-b is idempotent; to switch modes, build a
# set_strategy_mode tx with the admin keypair (see programs/fornex/src/
# instructions/set_strategy_mode.rs for the on-chain accounts).
```

---

## 90-Second Demo Script

**[0:00–0:08] Hook**
> "Fornex is a Solana vault where three AI agents debate every trade.
> Every cap, vote, and consensus is enforced inside an Anchor program.
> Every executed trade pays the agent operator on-chain from a separate
> treasury."

**[0:08–0:20] Landing → Verify-in-30**
- Open `/`. Hero, then scroll to **Verify in 30 seconds**.
- Click "Vault PDA" — Solana Explorer opens at the live account.
- "Every number on this page resolves to a real on-chain account."

**[0:20–0:32] /app dashboard**
- Open `/app`. Wallet not connected yet.
- Right column: **Per-agent reputation** card — BULL/BEAR/ZEN win rate decoded directly from the `AgentReputation` PDA.
- **Strategy mode** badge under risk status — current mode (Momentum) read from the on-chain `VaultStrategy` PDA.
- **Risk dashboard** — drawdown, high-water mark, losing streak, Sharpe-like — all client-side from on-chain `NavRecord` history.

**[0:32–0:46] Decision drawer (the wow moment)**
- Click any decision card in the centre column.
- Drawer expands: BULL / BEAR / ZEN trace blocks with full reasoning, FNV-1a tamper hash, copy buttons.
- Bottom: **Consensus receipt** — direction, leverage, confidence, Pyth SOL price + confidence interval, ISO timestamp, execution ref.
- "Every word of the agent's reasoning sits in 200 bytes per persona on chain."

**[0:46–0:58] Live stream**
- Top-right of `/proof` shows a green **live** pulse when the WebSocket is connected.
- Run `FORNEX_FORCE_DIRECTION=LONG FORNEX_SINGLE_CYCLE=1 npm run agent` in a side terminal.
- New decision card lands on `/proof` within seconds, no manual refresh — the page is subscribed to program logs.

**[0:58–1:18] Deposit + close + pay.sh**
- Connect Phantom (devnet). Deposit 0.1 SOL with TURBO priority.
- $FNRX balance updates. Live ticker fires.
- In side terminal: `FORNEX_FORCE_CLOSE=1 FORNEX_SINGLE_CYCLE=1 npm run agent`.
- Trust strip "pay.sh streamed" increments. Click it → real `SystemProgram::transfer` from treasury → agent on Explorer.

**[1:18–1:30] Close**
> "Three agents. On-chain reasoning. Programmable strategy modes.
> Real per-trade payments. Every claim verifiable on Solana right now."

---

## 3-Minute Demo Script

**[0:00–0:20] Problem + Intro**
> "DeFi vaults are black boxes. You deposit and hope. Fornex is different —
> every AI decision is on-chain, every leverage cap is enforced by the Solana
> program itself, and the agent gets paid per trade from a separate treasury
> wallet that anyone can audit."

**[0:20–0:50] Landing tour**
- `/` — hero, then the **Verify in 30 seconds** grid (six tiles, each one click from chain).
- The **Architecture** terminal block — judges screenshot diagrams.
- The **Roadmap** — Shipped / In progress / Mainnet.
- "No wallet. No login. Real blockchain data."

**[0:50–1:20] /app dashboard structure**
- Left column: Vault stats, Risk Status, **Strategy mode** (Momentum/MeanRevert/RangeDCA, decoded from the on-chain `VaultStrategy` PDA).
- Centre: **Debate feed** with live `logsSubscribe` push.
- Right column: Agent earnings, **Per-agent reputation**, **Risk dashboard** (drawdown, HWM, losing streak, Sharpe-like), equity curve.
- Pyth ● UP and RPC ● UP indicators in the topbar.

**[1:20–1:50] Deposit flow**
- Connect Phantom (devnet); 0.1 SOL, FAST priority fee.
- Approve in Phantom; $FNRX balance updates.
- Open Solana Explorer: deposit tx; $FNRX mint supply increased.

**[1:50–2:20] Decision drawer + reasoning trace**
- Click a card. Drawer expands.
- Three trace blocks: BULL / BEAR / ZEN. Full reasoning, byte counter ("X of 200 used"), FNV-1a hash for tamper evidence, copy buttons.
- Consensus receipt: Pyth SOL price ($X.XX ±$Y.YY), ISO timestamp, execution ref.
- "Click 'verify on-chain' — Explorer opens at the decision PDA."

**[2:20–2:40] Live stream + force-close**
- Open the page on `/proof`. Green **live** pill = WebSocket connected.
- In a side terminal: `FORNEX_FORCE_CLOSE=1 FORNEX_SINGLE_CYCLE=1 npm run agent`.
- New card lands within ~3 seconds. No polling, no refresh.

**[2:40–3:00] Withdraw + treasury proof**
- Withdraw shares; approve. $FNRX → 0; Explorer shows the burn tx.
- Click "pay.sh streamed" tile — Explorer at the treasury wallet shows real SOL transfers to the agent.
- "Treasury and agent are different keys. The 0.001 SOL per trade is paid by a third party, not the agent itself."

**[3:00–3:00] Close**
> "Multi-agent governance, on-chain caps, per-agent reputation, vault-level
> strategy modes, real per-trade payments, and a tiny @fornex/sdk so anyone
> can read this data in one line. Every primitive lives on Solana right now."

---

## Shot List

| Shot | What to Show |
|---|---|
| 1 | Browser: Landing hero |
| 2 | Browser: Verify-in-30 grid (six tiles) |
| 3 | Browser: Architecture terminal block |
| 4 | Browser: Roadmap (Shipped column expanded) |
| 5 | Browser: `/app` Vault Stats |
| 6 | Browser: `/app` Strategy mode badge |
| 7 | Browser: `/app` Per-agent reputation card |
| 8 | Browser: `/app` Risk dashboard tiles |
| 9 | Browser: Phantom connect modal |
| 10 | Browser: Deposit form + priority selector |
| 11 | Phantom: Approve transaction popup |
| 12 | Browser: $FNRX balance updated |
| 13 | Browser: Solana Explorer — deposit tx |
| 14 | Browser: Decision card expanded — drawer with three trace blocks |
| 15 | Browser: Decision drawer — consensus receipt with Pyth price |
| 16 | Browser: `/proof` with green **live** pulse pill visible |
| 17 | Terminal: Force-close cycle running |
| 18 | Browser: New decision lands on `/proof` within seconds |
| 19 | Browser: pay.sh streamed tile → Explorer treasury page |
| 20 | Browser: Withdraw → Phantom approve |
| 21 | Browser: $FNRX balance → 0 |
| 22 | Terminal: `pm2 logs fornex-agent --lines 10` — boxed output with strategy mode line |
| 23 | Browser: `/judges` FAQ — "How does the dashboard get live updates without a backend?" |
| 24 | Editor: `packages/sdk/README.md` quick-start, then `npm install @fornex/sdk` |

---

## Browser Pages to Open

1. **Landing**: `https://fornexlab.vercel.app/`
2. **App**: `https://fornexlab.vercel.app/app`
3. **Proof**: `https://fornexlab.vercel.app/proof`
4. **Judges**: `https://fornexlab.vercel.app/judges`
5. **Program**: `https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet`
6. **$FNRX Mint**: `https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet`
7. **Treasury**: `https://explorer.solana.com/address/HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat?cluster=devnet`
8. **Agent on Drift** (when live): `https://app.drift.trade/?authority=<AGENT_PUBKEY>&network=devnet`

---

## Backup Plan (If Live TX Fails)

Devnet RPC can be unstable. If a transaction fails or times out:

1. Switch to TURBO priority fee — higher tip improves inclusion speed.
2. Use the pre-recorded explorer links below to show real past transactions.
3. Show existing on-chain decisions on `/proof` to demonstrate the protocol is live.
4. Show PM2 logs to demonstrate autonomous agent activity.
5. The dashboard polling backstop still refreshes every 30s even when the live stream is unreachable.

Pre-recorded demo transaction links (devnet):
- Deposit: `https://solscan.io/tx/4AQNwfbUs1Z3cbo7VLreCeLgrrh1r7PnCzoKQzYQoL97JgQiQw4TWeiHpJsjvy6roAwq9F4BSqdukfsEcBsZRvRj?cluster=devnet`
- Withdraw: `https://solscan.io/tx/4bfNiVKpZFKAzYvNmkUbbF2xzPGQKsq8faUqsKMFjbz6VzN2ef1qNFWMZahP3ScHQ7sropae9DfLcj5khVcbtwR1?cluster=devnet`
