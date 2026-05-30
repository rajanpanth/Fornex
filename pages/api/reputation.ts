import type { NextApiRequest, NextApiResponse } from "next";

/**
 * /api/reputation
 * ----------------
 * Computes per-persona (BULL / BEAR / ZEN) win rate from data that already
 * exists on-chain, without depending on the `AgentReputation` PDA.
 *
 * Why: the deployed devnet program is immutable (no upgrade authority) and
 * predates Phase B, so `init_agent_reputation` can never run against it and
 * the PDA can never be created. The raw inputs the PDA would have tracked,
 * however, are fully on-chain:
 *
 *   - Each persona's vote direction lives in the `MultiAgentDecision` PDA.
 *   - Realized PnL lives in the `SyntheticPosition` PDA (`realized_pnl`).
 *
 * We join each CLOSED position to the decision that opened it (same
 * direction, nearest open timestamp) and score with the EXACT rule from
 * the on-chain `update_agent_reputation::scored`:
 *
 *   - FLAT vote               → excluded (no directional call)
 *   - LONG  vote & pnl > 0    → correct
 *   - SHORT vote & pnl < 0    → correct
 *   - pnl == 0                → counts toward total, never correct
 *
 * Routes through the server so the Helius key never reaches the browser,
 * and caches the last good payload to survive devnet RPC rate limits.
 */

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  "HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://api.devnet.solana.com";

const DECISION_ACCOUNT_SIZE = 1002;
const LEGACY_DECISION_ACCOUNT_SIZE = 986;
const SYNTHETIC_POSITION_SIZE = 104;

// Max seconds between a position's open and its opening decision for them to
// be considered the same trade. The agent logs the decision in the same
// cycle it opens the position (observed gap 0-2s); 30 min is a very safe
// ceiling that still can't collide across distinct trades.
const MATCH_WINDOW_SECONDS = 1800;

type Persona = "bull" | "bear" | "zen";

type RpcAccount = {
  pubkey: string;
  account: { data: [string, string] };
};

type DecodedDecision = {
  decisionIndex: number;
  bull: number;
  bear: number;
  zen: number;
  consensusDirection: number;
  executed: boolean;
  timestamp: number;
};

type DecodedPosition = {
  positionIndex: number;
  direction: number;
  openedAt: number;
  closedAt: number;
  realizedPnl: number;
  isOpen: boolean;
};

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message || `RPC ${method} failed with ${response.status}`
    );
  }
  return payload.result;
}

function getProgramAccounts(
  dataSize: number,
  withVaultMemcmp: boolean
): Promise<RpcAccount[]> {
  const filters: unknown[] = [{ dataSize }];
  if (withVaultMemcmp) {
    filters.push({ memcmp: { offset: 8, bytes: VAULT_ADDRESS } });
  }
  return rpc("getProgramAccounts", [
    PROGRAM_ID,
    { encoding: "base64", filters },
  ]) as Promise<RpcAccount[]>;
}

function decodeDecision(account: RpcAccount): DecodedDecision {
  const data = Buffer.from(account.account.data[0], "base64");
  let o = 8; // discriminator
  o += 32; // vault
  const decisionIndex = data.readUInt32LE(o);
  o += 4;
  o += 16; // market

  // AgentVote = direction(1) leverage(1) confidence(1) reasoning(200) = 203
  const voteDirection = (offset: number) => data.readUInt8(offset);
  const bull = voteDirection(o);
  const bear = voteDirection(o + 203);
  const zen = voteDirection(o + 203 * 2);
  const consensusDirection = voteDirection(o + 203 * 3);
  o += 203 * 4;

  o += 8; // size_usd
  const executed = data.readUInt8(o) === 1;
  o += 1;
  o += 88; // execution_ref
  o += 8; // pnl_lamports (always 0 on-chain)
  const timestamp = Number(data.readBigInt64LE(o));

  return { decisionIndex, bull, bear, zen, consensusDirection, executed, timestamp };
}

function decodePosition(account: RpcAccount): DecodedPosition {
  const data = Buffer.from(account.account.data[0], "base64");
  let o = 8; // discriminator
  o += 32; // vault
  const positionIndex = data.readUInt32LE(o);
  o += 4;
  const direction = data.readUInt8(o);
  o += 1;
  o += 1; // leverage
  o += 8; // entry_price
  o += 8; // close_price
  o += 8; // collateral_lamports
  o += 8; // size_usd
  const openedAt = Number(data.readBigInt64LE(o));
  o += 8;
  const closedAt = Number(data.readBigInt64LE(o));
  o += 8;
  const realizedPnl = Number(data.readBigInt64LE(o));
  o += 8;
  const isOpen = data.readUInt8(o) === 1;

  return { positionIndex, direction, openedAt, closedAt, realizedPnl, isOpen };
}

/** Mirror of on-chain `scored()`: returns [deltaCorrect, deltaTotal]. */
function scored(direction: number, pnl: number): [number, number] {
  if (direction === 0) return [0, 0]; // FLAT — no directional call
  const correct =
    (direction === 1 && pnl > 0) || (direction === 2 && pnl < 0);
  return [correct ? 1 : 0, 1];
}

type RepCounters = Record<Persona, { correct: number; total: number }>;

function computeReputation(
  decisions: DecodedDecision[],
  positions: DecodedPosition[]
): { rep: RepCounters; matched: number; closed: number } {
  const rep: RepCounters = {
    bull: { correct: 0, total: 0 },
    bear: { correct: 0, total: 0 },
    zen: { correct: 0, total: 0 },
  };

  // Candidate "opening" decisions: executed with a directional consensus.
  const opens = decisions.filter(
    (d) => d.executed && (d.consensusDirection === 1 || d.consensusDirection === 2)
  );
  const closed = positions
    .filter((p) => !p.isOpen && p.closedAt > 0)
    .sort((a, b) => a.openedAt - b.openedAt);

  const usedDecisions = new Set<number>();
  let matched = 0;

  for (const pos of closed) {
    let best: DecodedDecision | null = null;
    let bestGap = Infinity;
    for (const dec of opens) {
      if (usedDecisions.has(dec.decisionIndex)) continue;
      if (dec.consensusDirection !== pos.direction) continue;
      const gap = Math.abs(dec.timestamp - pos.openedAt);
      if (gap < bestGap) {
        bestGap = gap;
        best = dec;
      }
    }
    if (!best || bestGap > MATCH_WINDOW_SECONDS) continue;

    usedDecisions.add(best.decisionIndex);
    matched += 1;

    (["bull", "bear", "zen"] as Persona[]).forEach((persona) => {
      const [dc, dt] = scored(best![persona], pos.realizedPnl);
      rep[persona].correct += dc;
      rep[persona].total += dt;
    });
  }

  return { rep, matched, closed: closed.length };
}

type CachedPayload = {
  body: ReputationResponse;
  timestamp: number;
};

type ReputationResponse = {
  bull: { correct: number; total: number };
  bear: { correct: number; total: number };
  zen: { correct: number; total: number };
  closedTrades: number;
  matchedTrades: number;
  lastUpdated: number; // unix seconds of most recent matched close
  source: "computed";
};

const CACHE_KEY = "__fornexReputationCache";
const FRESH_MS = 30_000;

function getCache(): CachedPayload | null {
  return (globalThis as any)[CACHE_KEY] || null;
}
function setCache(payload: CachedPayload) {
  (globalThis as any)[CACHE_KEY] = payload;
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const now = Date.now();
  const cached = getCache();
  if (cached && now - cached.timestamp < FRESH_MS) {
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ ...cached.body, cached: true });
    return;
  }

  try {
    const [current, legacy, positions] = await Promise.all([
      getProgramAccounts(DECISION_ACCOUNT_SIZE, false),
      getProgramAccounts(LEGACY_DECISION_ACCOUNT_SIZE, false),
      getProgramAccounts(SYNTHETIC_POSITION_SIZE, true),
    ]);

    const decisions = [...current, ...legacy].map(decodeDecision);
    const decodedPositions = positions.map(decodePosition);

    const { rep, matched, closed } = computeReputation(decisions, decodedPositions);

    const lastUpdated = decodedPositions
      .filter((p) => !p.isOpen && p.closedAt > 0)
      .reduce((max, p) => Math.max(max, p.closedAt), 0);

    const body: ReputationResponse = {
      bull: rep.bull,
      bear: rep.bear,
      zen: rep.zen,
      closedTrades: closed,
      matchedTrades: matched,
      lastUpdated,
      source: "computed",
    };

    setCache({ body, timestamp: now });
    res.setHeader("cache-control", "no-store");
    res.status(200).json(body);
  } catch (error: any) {
    const stale = getCache();
    if (stale) {
      console.warn(
        "[fornex] /api/reputation: RPC failed, serving stale cache:",
        error?.message
      );
      res.setHeader("cache-control", "no-store");
      res.status(200).json({ ...stale.body, stale: true });
      return;
    }
    console.error("[fornex] /api/reputation failed:", error);
    res.status(503).json({ error: error?.message || "Failed to compute reputation" });
  }
}
