# Fornex — 2.5–3 min demo script

Target: **~400 words at ~145 wpm.** Read slightly slower than feels natural.
`///` = pause. [Square brackets] = stage direction, do not read them.

This is the longer cut of `TELEPROMPTER.md`. The 90s version hits the four
beats Harkirat named; this version states the actual idea, opens real Rust
source on screen, and gives the pay.sh agentic-payment beat its own moment.

All hard numbers below are verified against source:
- 19 Anchor instructions (`programs/fornex/src/lib.rs`)
- BULL 3× / BEAR 2× / ZEN 2×, confidence floor 60% (`log_multi_agent_decision.rs`)
- NAV bounds +10% up / −25% down per cycle (`update_nav.rs`)
- Synthetic collateral capped at 50% of NAV, Pyth price ≤ 60s old (`open_synthetic_position.rs`)

---

## 0:00 – 0:18 — The idea, in one breath

[On screen: `/` landing hero, fullscreen 1080p.]

Fornex is an on-chain perp vault on Solana where three AI agents trade,
and every decision they make has an on-chain receipt.
///
The interesting part isn't the AI. It's that we didn't plug into someone
else's perp. We wrote our own perp primitive inside our own Anchor program.

---

## 0:18 – 0:50 — Technically heavy, enforced in Rust

[Cut to Solana Explorer → program `H6vbfTp6…6vZf`, Anchor IDL tab.]

The Fornex program ships nineteen Anchor instructions.
///
The agents are three GPT-4o personas — Bull, Bear, Zen — but they don't
hold any power.
[Open `log_multi_agent_decision.rs` in editor.]
Every leverage cap lives in Rust. Bull is capped at three-x, Bear and Zen
at two-x.
///
A trade marked executed is rejected on-chain unless consensus confidence
clears sixty percent.
///
NAV writes are bounded: up ten percent, down twenty-five percent, per cycle.
[Highlight the `require!` lines.]
The agent key signs these transactions, but it physically cannot exceed
these numbers. The program rejects it.

---

## 0:50 – 1:20 — Our own perp

[Open `open_synthetic_position.rs`.]

This is the perp. `open_synthetic_position`.
///
Collateral is capped at fifty percent of NAV. Entry price is read from Pyth,
rejected if it's older than sixty seconds.
///
[Switch to a SyntheticPosition account on Explorer.]
Each position is a real on-chain account. Pyth-marked at open, Pyth-marked
at close, realized PnL computed and bounded in the program.
///
No external dex. When Drift's devnet went down, Fornex still traded.

---

## 1:20 – 1:50 — Real on-chain proof

[Switch to `/proof`, click the top decision card, open drawer.]

Every cycle writes a `MultiAgentDecision` account.
///
Bull, Bear, and Zen, two hundred bytes of reasoning each, plus a
Pyth-stamped price.
[Click the Explorer link inside the drawer.]
Same account, decoded by Solana Explorer. Real bytes, real signatures,
no database in between.

---

## 1:50 – 2:20 — Agentic payments (pay.sh)

[Switch to `/app`, point at the Agent Earnings tile.]

On every executed trade, a separate treasury wallet streams
point-zero-zero-one SOL to the agent.
[Hover the pay.sh tile, then the two distinct wallet addresses.]
Treasury and agent are different keys. The code refuses to sign a
self-transfer.
///
It's a third party paying the operator, on-chain, per trade.

---

## 2:20 – 2:45 — Honest close

[Cut to README "Roadmap" section.]

Shipped on devnet today: the multi-agent brain, on-chain caps, our
synthetic perp, and the pay.sh stream.
///
Per-agent reputation and strategy modes are code-complete, awaiting the
next redeploy. That's in the README, stated plainly.

---

## 2:45 – 3:00 — Links

The program, the vault, and every decision are live on devnet right now.
Links are on screen and in the README.
///
Thanks for watching.

[End screen: live URL `fornexlab.vercel.app` + `/proof` + GitHub + program address.]

---

## Why this cut (for a 30-second-attention reviewer)

- States the **actual idea** in the first 18 seconds: "we wrote our own perp
  primitive" — the exact thing Harkirat called "great."
- Opens **real Rust source** on screen for the caps, not just claims. Kills
  the "LLM wrapper" suspicion directly.
- pay.sh gets its own beat because he named it specifically as a bonus.
- The honesty beat is short and confident, not apologetic.

## Recording notes

- 145 wpm. Don't say "really" or "very." Cut filler.
- Browser zoom 110% at 1080p so Explorer reads clearly.
- Pre-open tabs so cuts are instant: `/proof`, the program Explorer page,
  `log_multi_agent_decision.rs`, and `open_synthetic_position.rs`.
- Force one LONG and one SHORT round-trip before recording so Agent Earnings
  and the risk numbers are non-zero.
- Disable browser / system / Slack / Discord notifications. OS dark mode on.
- Audio: lav or USB condenser, -20 dBFS target. Capture: OBS, 1080p60, CRF 18.
- Two takes minimum. The first take is to find where you stumble.

## Common problems and fixes

| Problem | Fix |
|---|---|
| Live pulse pill is grey on `/proof` | Set `NEXT_PUBLIC_HELIUS_WSS_URL` in `.env.local`, restart `npm run dev`. |
| New decision doesn't land in time | The 30 s polling backstop will pick it up. Don't say "live" if you're showing the backstop. |
| Phantom approval fails | Use TURBO priority fee. Devnet is congested. |
| Risk dashboard says "Need at least two settled trades" | Force-close one more round-trip. Needs ≥ 2 NAV records. |
