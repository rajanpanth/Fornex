# ElevenLabs paste-ready voiceover — Fornex full explainer

Paste the block below straight into ElevenLabs. Numbers are spelled the way
TTS should say them, and `///` pauses are converted to `<break>` tags.
First person ("I"). Matches `DEMO_EXPLAINER_SCRIPT.md`.

## Suggested settings
- Voice: calm narration voice (Adam, Daniel, or Rachel).
- Speed: 0.95–1.0 (145 wpm reads confident; faster reads nervous).
- Stability: ~50%. Similarity: ~75%. Style exaggeration: low.

## TTS pronunciation fixes baked in
- "GPT four-o" not "GPT-4o"
- "P-N-L" so it spells the letters
- "pay dot s-h" so it reads the brand, not a sentence break
- "three-x / two-x" and "point zero zero one SOL" for clean number reading

---

```text
Fornex is an on-chain perpetuals vault on Solana, run by three AI agents. <break time="0.7s" /> You deposit SOL, you get a real share token back, and from that moment three agents, Bull, Bear, and Zen, debate the market every fifteen minutes and trade the vault for you. <break time="0.7s" /> The twist: I didn't just wrap someone else's exchange. I built my own perp, inside my own Anchor program. <break time="1.0s" />

Every fifteen minutes the agents wake up and read live market data, funding rate, open interest, long-short ratio, liquidation walls, pulled from Drift. <break time="0.7s" /> Bull wants momentum. Bear fades the crowd. Zen breaks the tie. <break time="0.7s" /> Two out of three wins. But here's the important part, the agents only suggest. They hold zero authority. <break time="1.0s" />

The program ships nineteen Anchor instructions, and every risk rule is enforced in Rust, not in the AI. <break time="0.7s" /> Bull is capped at three-x leverage, Bear and Zen at two-x. A trade is rejected on-chain unless the agents clear sixty percent confidence. <break time="0.7s" /> The vault's value can only move up ten percent or down twenty-five percent per cycle, and no single position can risk more than half the vault. <break time="0.7s" /> The agent key signs the transaction, but if it tries to break any of these, the program rejects it. The AI cannot override the chain. <break time="1.0s" />

This is the perp itself. Open synthetic position. <break time="0.7s" /> Each position is a real account on Solana, priced by Pyth at open and close, and the price is rejected if it's older than sixty seconds. <break time="0.7s" /> Profit and loss is computed in Rust and settled straight into the vault. No external exchange. When Drift's devnet went down, Fornex kept trading. <break time="1.0s" />

And every decision leaves a receipt. Each cycle writes a decision account with all three agents' reasoning, two hundred bytes each, plus the Pyth-verified price. <break time="0.7s" /> This is the same account decoded by Solana Explorer. Real bytes, real signatures, no database in between. <break time="1.0s" />

The agent also gets paid for its work. On every executed trade, a separate treasury wallet streams point zero zero one SOL to the agent, pay dot s-h style. <break time="0.7s" /> Treasury and agent are different keys, and the code refuses to sign a self-transfer. It's a third party paying the operator, on-chain, every single trade. <break time="1.0s" />

This isn't a laptop script. The agent runs twenty-four seven on an Azure virtual machine, restarting itself if it ever crashes. <break time="0.7s" /> The multi-agent brain, the on-chain caps, my synthetic perp, and the pay dot s-h stream are all live on devnet today. Per-agent reputation and strategy modes are code-complete, awaiting the next redeploy, and that's stated plainly in the README. <break time="0.7s" /> Everything you saw is verifiable on-chain right now. Thanks for watching.
```
