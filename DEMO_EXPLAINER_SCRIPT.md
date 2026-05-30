# Fornex — full explainer demo (≈ 2:50)

Walks through the whole idea so anyone gets it in one watch. Ordered to tick
the four things Harkirat asked for, out loud: own perp, technically heavy,
pay.sh, honest. First person ("I"), ~430 words ≈ 2:50 at 145 wpm.

`///` = pause. Read slightly slower than feels natural (~145 wpm).

All hard numbers verified against source:
- 19 Anchor instructions (`programs/fornex/src/lib.rs`)
- BULL 3× / BEAR 2× / ZEN 2×, confidence floor 60% (`log_multi_agent_decision.rs`)
- NAV bounds +10% up / −25% down per cycle (`update_nav.rs`)
- Synthetic collateral ≤ 50% of NAV, Pyth price ≤ 60s old (`open_synthetic_position.rs`)
- 24/7 always-on agent on an Azure VM. Azure OpenAI = the GPT-4o brain.

---

### 0:00 – 0:20 — What it is, in plain words

**Say:**
> Fornex is an on-chain perpetuals vault on Solana, run by three AI agents.
> ///
> You deposit SOL, you get a real share token back, and from that moment
> three agents — Bull, Bear, and Zen — debate the market every fifteen
> minutes and trade the vault for you.
> ///
> The twist: I didn't just wrap someone else's exchange. I built my own
> perp, inside my own Anchor program.

**On screen:**
- Landing hero at `/` (fullscreen 1080p).
- Quick pan showing "deposit → $FNRX shares → agents trade" if available.

---

### 0:20 – 0:45 — The agents, and why they have no real power

**Say:**
> Every fifteen minutes the agents wake up and read live market data —
> funding rate, open interest, long-short ratio, liquidation walls —
> pulled from Drift.
> ///
> Bull wants momentum. Bear fades the crowd. Zen breaks the tie.
> ///
> Two out of three wins. But here's the important part — the agents only
> suggest. They hold zero authority.

**On screen:**
- `/app` live ticker, then the agent terminal showing a real cycle:
  BULL / BEAR / ZEN votes with confidence %.
- Or the boxed agent log (the `╔═ FORNEX AUTONOMOUS AGENT` banner from `index.ts`).

---

### 0:45 – 1:20 — Technically heavy: the rules live in Rust

**Say:**
> The program ships nineteen Anchor instructions, and every risk rule is
> enforced in Rust — not in the AI.
> ///
> Bull is capped at three-x leverage, Bear and Zen at two-x. A trade is
> rejected on-chain unless the agents clear sixty percent confidence.
> ///
> The vault's value can only move up ten percent or down twenty-five percent
> per cycle, and no single position can risk more than half the vault.
> ///
> The agent key signs the transaction — but if it tries to break any of
> these, the program rejects it. The AI cannot override the chain.

**On screen:**
- `log_multi_agent_decision.rs` open; highlight `validate_vote(&bull_vote, 3)`
  and the `confidence >= 60` `require!`.
- Cut to `update_nav.rs`; highlight the `floor`/`ceil` bounds.
- Cut to `open_synthetic_position.rs`; highlight the `cap = nav / 2` line.

---

### 1:20 – 1:45 — My own perp (the part judges remember)

**Say:**
> This is the perp itself. Open synthetic position.
> ///
> Each position is a real account on Solana, priced by Pyth at open and
> close, and the price is rejected if it's older than sixty seconds.
> ///
> Profit and loss is computed in Rust and settled straight into the vault.
> No external exchange. When Drift's devnet went down, Fornex kept trading.

**On screen:**
- A `SyntheticPosition` account open on Solana Explorer (show entry price,
  leverage, realized PnL fields).
- Then `/app` position panel showing the live position.

---

### 1:45 – 2:10 — Real on-chain proof

**Say:**
> And every decision leaves a receipt. Each cycle writes a decision account
> with all three agents' reasoning — two hundred bytes each — plus the
> Pyth-verified price.
> ///
> This is the same account decoded by Solana Explorer. Real bytes, real
> signatures, no database in between.

**On screen:**
- `/proof` page, click the top decision card → drawer with full
  BULL/BEAR/ZEN reasoning.
- Click the Explorer link in the drawer → show the raw decoded account.

---

### 2:10 – 2:35 — pay.sh: the agent gets paid, on-chain

**Say:**
> The agent also gets paid for its work. On every executed trade, a separate
> treasury wallet streams point-zero-zero-one SOL to the agent — pay.sh style.
> ///
> Treasury and agent are different keys, and the code refuses to sign a
> self-transfer. It's a third party paying the operator, on-chain, every
> single trade.

**On screen:**
- `/app` Agent Earnings tile.
- Hover the pay.sh entry, then show the two distinct wallet addresses on
  Explorer (treasury → agent transfer tx).

---

### 2:35 – 2:50 — Always-on + honest close

**Say:**
> This isn't a laptop script. The agent runs twenty-four-seven on an Azure
> virtual machine, restarting itself if it ever crashes.
> ///
> The multi-agent brain, the on-chain caps, my synthetic perp, and the
> pay.sh stream are all live on devnet today. Per-agent reputation and
> strategy modes are code-complete, awaiting the next redeploy — and that's
> stated plainly in the README.
> ///
> Everything you saw is verifiable on-chain right now. Thanks for watching.

**On screen:**
- Quick shot of the Azure VM (portal showing the running VM, or an SSH
  terminal tailing the live agent log / PM2 process).
- README "Roadmap" section scrolled to Shipped vs In-progress.
- End screen: live URL `fornexlab.vercel.app` + `/proof` + program address + GitHub.

---

## How this maps to Harkirat's checklist (reference, don't read aloud)

| He asked for | Where the script hits it |
|---|---|
| "Creating your own perp is great" | 0:00 idea line + 1:20 synthetic perp beat |
| "Technically heavy, has a technical moat" | 0:45 Rust-enforced caps, 19 instructions |
| "Agentic payments / pay.sh, anything on top would be nice" | 2:10 pay.sh beat |
| "Not a UI that talks to the blockchain" | 1:45 on-chain proof, raw account decode |
| "Be honest about what's shipped" | 2:35 honest close |
| Architecture diagram, 30-sec reviewer | README diagram + `/proof` one-click verify |

## Recording notes

- 145 wpm. Don't say "really" or "very." Cut filler.
- Browser zoom 110% at 1080p so Explorer reads clearly.
- Pre-open tabs so cuts are instant: `/proof`, the program Explorer page,
  `log_multi_agent_decision.rs`, `update_nav.rs`, `open_synthetic_position.rs`.
- Force one LONG and one SHORT round-trip before recording so Agent Earnings
  and the risk numbers are non-zero.
- Disable browser / system / Slack / Discord notifications. OS dark mode on.
- Audio: lav or USB condenser, -20 dBFS target. Capture: OBS, 1080p60, CRF 18.
- Two takes minimum.

## Accuracy guardrails

- Infra is described as an "always-on agent on an Azure VM." Azure OpenAI is
  the GPT-4o brain. The 0:45 line can also say "three GPT-4o agents running
  on Azure OpenAI."
