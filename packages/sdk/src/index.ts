/**
 * @fornex/sdk — read-only client for the Fornex protocol on Solana.
 *
 * This package is intentionally small. It exposes typed account decoders
 * and PDA helpers so any TypeScript app can read Fornex state in one line:
 *
 *   import { getVault, getDecisions, FORNEX_DEVNET } from "@fornex/sdk";
 *   const vault = await getVault(connection, FORNEX_DEVNET.vault);
 *
 * No write helpers are exported. All vault writes are gated by on-chain
 * authority constraints — this SDK is for indexers, dashboards, and
 * analytics. The Fornex agent runtime builds its own instructions
 * directly against the deployed program.
 */

export * from "./constants";
export * from "./pda";
export * from "./reader";
export * from "./types";
export * from "./vault";
export * from "./decisions";
export * from "./navRecords";
export * from "./reputation";
export * from "./strategy";
