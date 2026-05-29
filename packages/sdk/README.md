# @fornex/sdk

Read-only TypeScript client for the [Fornex protocol](https://fornexlab.vercel.app)
on Solana. Decode every Fornex on-chain account in one line.

> Devnet only at the time of writing. Mainnet ids will land here when the
> protocol ships there.

## Install

```bash
npm install @fornex/sdk @solana/web3.js
```

## Quick start

```ts
import { Connection } from "@solana/web3.js";
import {
  FORNEX_DEVNET,
  getVault,
  getDecisions,
  getNavHistory,
  getAgentReputation,
  getVaultStrategy,
} from "@fornex/sdk";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const vault = await getVault(connection, FORNEX_DEVNET.vault);
console.log("NAV (lamports):", vault?.nav);

const decisions = await getDecisions(connection, FORNEX_DEVNET.programId, {
  limit: 10,
});
console.log("Latest 10 decisions:", decisions.length);

const nav = await getNavHistory(connection, FORNEX_DEVNET.programId, FORNEX_DEVNET.vault);
console.log("NavRecord count:", nav.length);

const rep = await getAgentReputation(
  connection,
  FORNEX_DEVNET.programId,
  FORNEX_DEVNET.vault
);
console.log("BULL win rate:", rep && `${rep.bullCorrect}/${rep.bullTotal}`);

const strategy = await getVaultStrategy(
  connection,
  FORNEX_DEVNET.programId,
  FORNEX_DEVNET.vault
);
console.log("Active mode:", strategy?.mode ?? "Momentum (default)");
```

## What's exported

| Export | Purpose |
|---|---|
| `FORNEX_DEVNET` | Program id, vault PDA, $FNRX mint for the live devnet deployment. |
| `ACCOUNT_SIZES` | Anchor account sizes for `MultiAgentDecision` (current + legacy) and `NavRecord`. |
| `getVault` / `decodeVault` | Read the Vault PDA. NAV, share supply, win counters, inception NAV. |
| `getDecisions` / `decodeDecision` | Read every `MultiAgentDecision` PDA. Both current (with Pyth fields) and legacy sizes. |
| `getNavHistory` / `decodeNavRecord` | Time-series of NAV snapshots written on closed trades. |
| `getAgentReputation` / `decodeAgentReputation` | Per-persona on-chain win rate (BULL / BEAR / ZEN). |
| `getVaultStrategy` / `decodeVaultStrategy` | Active strategy mode (Momentum / MeanRevert / RangeDCA). |
| `derive*Pda` helpers | All Fornex PDAs are derivable from this package without a separate IDL. |

No write helpers ship with this package. The Fornex Anchor program enforces
authority constraints on every mutating instruction; this SDK is intentionally
scoped to indexer / dashboard / analytics use cases.

## License

MIT.
