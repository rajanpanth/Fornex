# Fornex — Teleprompter Script (3-minute demo)

Read this aloud. One line per breath. Pauses are marked with `///`.
Square brackets are stage directions, do not read them.

---

## 0:00 — Hook

[On screen: `/` landing hero in 1080p.]

Three AI agents.
///
One Solana program.
///
Every decision has a receipt.
///
[1-second pause.]

This is Fornex.
///
A non-custodial AI trading vault on Solana.
///
The agent debates every fifteen minutes.
///
The Anchor program enforces every cap.
///
And on every executed trade,
a separate treasury wallet pays the agent on chain.

[Cursor: scroll the hero down two clicks to "Verify in 30 seconds".]

---

## 0:25 — Verify in 30 seconds

[On screen: the six-tile verify grid.]

Every claim on this site
resolves to a real on-chain account.
///
Click any tile,
Solana Explorer opens at the live deployment.

[Click "Vault PDA". Solana Explorer opens in a new tab. Hold 1 second. Switch back.]

The Vault.
The program.
The mint.
Every decision PDA.
The agent wallet.
The treasury wallet.
///
No backend.
No staging.
Devnet only.

---

## 0:50 — The dashboard

[Switch to `/app`. Wallet not yet connected.]

This is the dashboard.

[Cursor pans across the columns.]

On the left:
the vault,
the risk caps,
and the active strategy mode.
///
In the centre:
the live debate feed.
///
On the right:
agent earnings,
per-agent reputation,
and the risk dashboard.

[Hover the strategy mode badge.]

The strategy mode is one byte
on the on-chain VaultStrategy PDA.
///
Momentum,
mean-revert,
or range-D-C-A.
///
The brain reads it
at the top of every cycle.

---

## 1:25 — The decision drawer

[Click the latest decision card in the centre column.]

Click any decision card.

[The drawer expands. Wait one beat for the animation.]

Bull.
Bear.
Zen.
///
Each agent's full reasoning,
two hundred bytes,
sits permanently
on chain.
///
The hash on the right
is an FNV-1a fingerprint
of the on-chain bytes.
Tamper-evident at a glance.

[Scroll inside the drawer to the consensus receipt.]

At the bottom,
the consensus receipt.
///
The Pyth-stamped SOL price
when the decision landed.
///
Plus or minus the confidence interval.
///
The execution reference,
one click from Solana Explorer.

---

## 1:55 — The live stream

[Switch to `/proof`. Point at the green "live" pulse pill in the top-right.]

This is the proof page.
///
That green dot
means we are subscribed
to program logs over WebSocket.
///
No backend.
Just `logsSubscribe`
on the Fornex program ID.

[Switch to a side terminal already cd'd to repo root.]

Watch what happens
when the agent posts a new decision.

[Type and press enter:]
`FORNEX_FORCE_DIRECTION=LONG FORNEX_SINGLE_CYCLE=1 npm run agent`

[Switch back to `/proof`. Wait ~3 seconds. New card animates in at the top.]

A new card.
No refresh.
Live from chain.

---

## 2:20 — Deposit and pay.sh

[Switch to `/app`. Click "Connect Wallet". Approve in Phantom.]

Now connect a wallet.
///
Deposit zero point one SOL
with a turbo priority fee.

[Approve the deposit in Phantom. Wait for the toast.]

The vault mints F-N-R-X
to the depositor.
///
F-N-R-X is a real S-P-L token,
minted on chain
through the vault's CPI.

[Open a side terminal.]

Now we close the open position.

[Type and press enter:]
`FORNEX_FORCE_CLOSE=1 FORNEX_SINGLE_CYCLE=1 npm run agent`

[Wait for the cycle to finish.]

When the trade settles,
the agent operator gets paid.
///
A real `SystemProgram::transfer`
from the treasury keypair
to the agent wallet.

[Click the "pay.sh streamed" tile in the trust strip. Solana Explorer opens at the treasury wallet.]

Treasury and agent
are different keys.
///
The pay.sh stream
is a third party
funding the operator,
not the operator
paying themselves.

---

## 2:55 — Close

[Switch back to `/`. Scroll to the roadmap.]

That's Fornex.
///
Multi-agent governance,
on-chain caps,
per-agent reputation,
strategy modes,
real per-trade payments.
///
Every primitive
lives on Solana
right now.

[Hold on the roadmap "Shipped" column for 2 seconds.]

Built for the Solana India Cohort Capstone.
///
Thanks for watching.

[End screen.]

---

## Recording checklist

- [ ] Browser zoom 110% so text reads clearly at 1080p
- [ ] Phantom approval sound enabled (the click sells the deposit beat)
- [ ] Side terminal pre-cd'd to repo root
- [ ] Run `npx ts-node agent/scripts/init-phase-b.ts` once before recording so the reputation card has data
- [ ] Run one LONG and one SHORT round-trip before recording so the risk dashboard shows non-zero drawdown / HWM
- [ ] Disable browser notifications, system notifications, Slack, Discord
- [ ] Close every other tab — Phantom remembers the last tab and asks again if it changes
- [ ] Set OS dark mode so the cinematic hero looks right
- [ ] Audio: lavalier mic if available, USB condenser otherwise; -20 dBFS target
- [ ] Capture: OBS, 1080p60, x264, CRF 18, in MP4

## Common problems and fixes

| Problem | Fix |
|---|---|
| Live pulse pill is grey, not green | Set `NEXT_PUBLIC_HELIUS_WSS_URL` in `.env.local` and restart `npm run dev`. Public devnet WSS is rate-limited; Helius is reliable. |
| New decision doesn't land within 5 s | Check the side-terminal log finished. The 30 s polling backstop will pick it up either way. Mention the backstop on camera if needed. |
| Phantom approval fails | TURBO priority fee. Devnet is congested. |
| Reputation tile says "PDA not initialized" | Run `npx ts-node agent/scripts/init-phase-b.ts` once. |
| Risk dashboard shows "Need at least two settled trades" | Force-close one more round-trip. The metrics need ≥ 2 NAV records. |
