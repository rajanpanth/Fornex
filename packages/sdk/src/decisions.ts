import { Connection, PublicKey } from "@solana/web3.js";
import { ACCOUNT_SIZES } from "./constants";
import { Reader } from "./reader";
import type { AgentVote, Decision } from "./types";

function readVote(r: Reader): AgentVote {
  const direction = r.u8();
  const leverage = r.u8();
  const confidence = r.u8();
  const reasoningBytes = r.fixedBytes(200);
  const end = reasoningBytes.indexOf(0);
  return {
    direction,
    leverage,
    confidence,
    reasoning: reasoningBytes
      .subarray(0, end === -1 ? reasoningBytes.length : end)
      .toString("utf8"),
    reasoningBytes: Array.from(reasoningBytes),
  };
}

/**
 * Decode a `MultiAgentDecision` account. Returns null on malformed data
 * (so callers can `.filter(Boolean)` over a getProgramAccounts batch
 * without crashing on legacy or partially-written accounts).
 */
export function decodeDecision(
  pubkey: PublicKey,
  data: Buffer
): Decision | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    r.publicKey(); // vault — not exposed; callers know which vault they queried
    const decisionIndex = r.u32();
    const market = r.fixedString(16);
    const bullVote = readVote(r);
    const bearVote = readVote(r);
    const zenVote = readVote(r);
    const consensus = readVote(r);
    const sizeUsd = r.u64();
    const executed = r.bool();
    const executionRef = r.fixedString(88);
    const pnlLamports = r.i64();
    const timestamp = Number(r.i64());

    // Pyth fields exist only on the post-upgrade account size.
    const isCurrent = data.length >= ACCOUNT_SIZES.decision;
    const solPriceVerified = isCurrent ? r.u64() : 0n;
    const priceConfidence = isCurrent ? r.u64() : 0n;

    return {
      pubkey,
      decisionIndex,
      market,
      bullVote,
      bearVote,
      zenVote,
      consensus,
      sizeUsd,
      executed,
      executionRef,
      pnlLamports,
      timestamp,
      solPriceVerified,
      priceConfidence,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch every decision PDA created by the given program. Pass the program
 * id from `FORNEX_DEVNET` (or your own deployment). Both current and
 * legacy decision sizes are queried so existing history is never lost.
 *
 * Sorted newest first. Limit is applied client-side after sort so callers
 * can pass small bounds without missing recent activity.
 */
export async function getDecisions(
  connection: Connection,
  programId: PublicKey,
  options: { limit?: number } = {}
): Promise<Decision[]> {
  const [current, legacy] = await Promise.all([
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: ACCOUNT_SIZES.decision }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: ACCOUNT_SIZES.decisionLegacy }],
    }),
  ]);

  const decoded = [...current, ...legacy]
    .map(({ pubkey, account }) =>
      decodeDecision(pubkey, Buffer.from(account.data))
    )
    .filter((d): d is Decision => Boolean(d))
    .sort((a, b) => b.decisionIndex - a.decisionIndex);

  return options.limit ? decoded.slice(0, options.limit) : decoded;
}
