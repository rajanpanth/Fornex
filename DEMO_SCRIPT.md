# Fornex Protocol — Demo Script

## 90-Second Demo Script

**[0:00–0:10] Hook**
> "This is Fornex — a Solana vault where three AI agents debate every trade, and every decision is stored permanently on-chain. No black box. No trust required."

**[0:10–0:25] Landing page**
- Open landing page
- Point to live on-chain decisions loading without a wallet
- Show decision count and BULL/BEAR/ZEN directions updating from chain
- "This data is not mocked. It's fetched live from Solana devnet right now."

**[0:25–0:40] Deposit**
- Connect Phantom (devnet)
- Enter deposit amount (e.g. 0.1 SOL)
- Select priority fee (TURBO for demo speed)
- Click Deposit → approve in Phantom
- Show $FNRX balance appearing in real time

**[0:40–0:55] Strategy Orders + Vote Breakdown**
- Point to Strategy Orders panel: "This is the latest AI consensus decoded directly from an on-chain account."
- Open a decision card → show BULL/BEAR/ZEN individual votes and reasoning
- Show Pyth-verified SOL price on the decision card

**[0:55–1:10] Withdraw + Burn**
- Click Withdraw → approve
- Show $FNRX balance drop to zero
- "The token was burned on-chain via Token Program CPI."

**[1:10–1:25] PM2 + Status Bar**
- Run in terminal: `pm2 logs fornex-agent --lines 10`
- Show boxed output with CONSENSUS, on-chain tx, NAV update
- Point to Pyth ● and RPC ● status indicators in the header

**[1:25–1:30] Close**
> "Every 15 minutes this runs autonomously. Every vote is auditable. Every NAV point is on Solana."

---

## 3-Minute Demo Script

**[0:00–0:20] Problem + Intro**
> "DeFi vaults are black boxes. You deposit and hope. Fornex is different — every AI decision is stored permanently on Solana and verifiable by anyone."

**[0:20–0:50] Landing Page — No Wallet**
- Open `/` — show hero and live decision counter
- Scroll to live decisions section
- Show BULL/BEAR/ZEN per-agent directions on each card
- Click one card to go to `/app`
- "No wallet. No login. Real blockchain data."

**[0:50–1:20] /app Dashboard**
- Show Vault Stats: NAV, total deposits, trade count
- Show $FNRX balance (initially 0)
- Show Pyth ● UP and RPC ● UP in header status bar
- Show Priority Fee selector

**[1:20–1:50] Deposit Flow**
- Connect Phantom (devnet)
- Enter 0.1 SOL, select FAST priority fee
- Approve transaction in Phantom
- $FNRX balance updates
- Open Solana Explorer → show deposit transaction
- Show $FNRX mint account: token supply increased

**[1:50–2:10] Decision Cards + Vote Breakdown**
- Scroll to DebateFeed / decision cards
- Open one → show all 3 agent votes (direction, leverage, confidence, reasoning)
- Show "SOL at decision: $X.XX Pyth verified ✓"
- Show on-chain address link

**[2:10–2:30] Strategy Orders Panel**
- Point to Strategy Orders panel
- Explain: "This reads the latest consensus directly from the on-chain account — not a database."

**[2:30–2:50] Withdraw + Burn Proof**
- Enter shares amount, click Withdraw
- Approve in Phantom
- $FNRX drops to 0
- Open Explorer → show burn transaction

**[2:50–3:00] PM2 Logs**
- `pm2 logs fornex-agent --lines 10`
- Show boxed output: CONSENSUS, on-chain tx hash, NAV record
- "This runs every 15 minutes, unattended."

---

## Shot List

| Shot | What to Show |
|---|---|
| 1 | Browser: Landing page hero |
| 2 | Browser: Live decisions section — cards with BULL/BEAR/ZEN directions |
| 3 | Browser: `/app` — Vault Stats, header status bar |
| 4 | Browser: Phantom connect modal |
| 5 | Browser: Deposit form + priority fee selector |
| 6 | Phantom: Approve transaction popup |
| 7 | Browser: $FNRX balance updated |
| 8 | Browser: Solana Explorer — deposit tx |
| 9 | Browser: Decision card expanded — vote breakdown + Pyth price |
| 10 | Browser: Strategy Orders panel |
| 11 | Browser: Withdraw → Phantom approve |
| 12 | Browser: $FNRX balance → 0 |
| 13 | Terminal: `pm2 logs fornex-agent --lines 10` — boxed output |
| 14 | Browser: Solana Explorer — $FNRX mint page |

---

## Commands to Show

```bash
# Show build passes
npm run build

# Show agent working
pm2 list
pm2 logs fornex-agent --lines 10

# Show signals live
npx ts-node agent/src/signals.ts

# Show brain output
npx ts-node agent/test-brain.ts

# anchor build note
# Run from a no-space path (e.g. C:\fornex) on Windows:
anchor build
```

---

## Browser Pages to Open

1. **Landing page**: `https://YOUR-VERCEL-DOMAIN.vercel.app/`
2. **App dashboard**: `https://YOUR-VERCEL-DOMAIN.vercel.app/app`
3. **Program on Explorer**: `https://explorer.solana.com/address/H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf?cluster=devnet`
4. **$FNRX Mint on Explorer**: `https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet`
5. **Vault PDA on Explorer**: `https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet`

---

## Phantom Actions Checklist

1. Switch Phantom to **Devnet** (Settings → Developer Settings → Change Network → Devnet)
2. Get devnet SOL from faucet: `solana airdrop 1 YOUR_WALLET_ADDRESS --url devnet`
3. Connect wallet on `/app`
4. Deposit (0.1 SOL recommended for demo speed)
5. Verify $FNRX appears in Phantom token list
6. Withdraw full balance
7. Verify $FNRX drops to 0 in Phantom

---

## Backup Plan (If Live TX Fails)

Devnet RPC can be unstable. If a transaction fails or times out:

1. **Switch to TURBO priority fee** — higher tip improves inclusion speed
2. **Use pre-recorded explorer links** already in README/SUBMISSION.md to show real past transactions
3. Explain: "Devnet RPC can experience congestion — here is a real transaction from earlier showing the same deposit flow."
4. Show existing on-chain decision accounts to demonstrate the protocol is live
5. Show PM2 logs to demonstrate autonomous agent activity regardless of RPC state

Pre-recorded demo transaction links:
- Deposit: `https://solscan.io/tx/4AQNwfbUs1Z3cbo7VLreCeLgrrh1r7PnCzoKQzYQoL97JgQiQw4TWeiHpJsjvy6roAwq9F4BSqdukfsEcBsZRvRj?cluster=devnet`
- Withdraw: `https://solscan.io/tx/4bfNiVKpZFKAzYvNmkUbbF2xzPGQKsq8faUqsKMFjbz6VzN2ef1qNFWMZahP3ScHQ7sropae9DfLcj5khVcbtwR1?cluster=devnet`
