import type { NextApiRequest, NextApiResponse } from "next";

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
  "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://api.devnet.solana.com";

const DECISION_ACCOUNT_SIZE = 1002;
const LEGACY_DECISION_ACCOUNT_SIZE = 986;

type Vote = {
  direction: number;
  leverage: number;
  confidence: number;
  reasoning: string;
  reasoningBytes: number[];
};

type RpcAccount = {
  pubkey: string;
  account: {
    data: [string, string];
  };
};

class Reader {
  private offset = 0;
  constructor(private readonly data: Buffer) {}

  skip(size: number) {
    this.offset += size;
  }

  u8() {
    const value = this.data.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  bool() {
    return this.u8() === 1;
  }

  u32() {
    const value = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u64() {
    const value = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return Number(value);
  }

  fixedBytes(size: number) {
    const bytes = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return bytes;
  }

  fixedString(size: number) {
    const bytes = this.fixedBytes(size);
    const end = bytes.indexOf(0);
    return bytes.subarray(0, end === -1 ? size : end).toString("utf8");
  }

  vote(): Vote {
    const direction = this.u8();
    const leverage = this.u8();
    const confidence = this.u8();
    const reasoningBytes = this.fixedBytes(200);
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
}

async function getProgramAccounts(dataSize: number): Promise<RpcAccount[]> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: dataSize,
      method: "getProgramAccounts",
      params: [
        PROGRAM_ID,
        {
          encoding: "base64",
          filters: [{ dataSize }],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message || `RPC request failed with ${response.status}`
    );
  }
  return payload.result || [];
}

function decodeDecision(account: RpcAccount) {
  const data = Buffer.from(account.account.data[0], "base64");
  const reader = new Reader(data);
  reader.skip(8); // Anchor discriminator
  reader.skip(32); // vault pubkey

  const decisionIndex = reader.u32();
  const market = reader.fixedString(16);
  const bullVote = reader.vote();
  const bearVote = reader.vote();
  const zenVote = reader.vote();
  const consensus = reader.vote();
  const sizeUsd = reader.u64();
  const executed = reader.bool();
  const executionRef = reader.fixedString(88);
  reader.skip(8); // pnl_lamports
  const timestamp = reader.u64();
  const solPriceVerified = data.length >= DECISION_ACCOUNT_SIZE ? reader.u64() : 0;
  const priceConfidence = data.length >= DECISION_ACCOUNT_SIZE ? reader.u64() : 0;

  return {
    pubkey: account.pubkey,
    decisionIndex,
    market,
    bullVote,
    bearVote,
    zenVote,
    consensus,
    sizeUsd,
    executed,
    executionRef,
    timestamp,
    solPriceVerified,
    priceConfidence,
  };
}

// Process-level cache so the API can keep serving the last good payload even
// when public devnet RPC is rate-limiting us (which is constant). This lets
// the UI stay populated instead of flashing error states.
type CachedPayload = {
  decisions: ReturnType<typeof decodeDecision>[];
  timestamp: number;
};

const CACHE_KEY = "__fornexDecisionsCache";
function getCache(): CachedPayload | null {
  return (globalThis as any)[CACHE_KEY] || null;
}
function setCache(payload: CachedPayload) {
  (globalThis as any)[CACHE_KEY] = payload;
}

const FRESH_MS = 20_000;

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const cached = getCache();
  const now = Date.now();
  if (cached && now - cached.timestamp < FRESH_MS) {
    res.setHeader("cache-control", "no-store");
    res.status(200).json({
      decisions: cached.decisions,
      count: cached.decisions.length,
      cached: true,
    });
    return;
  }

  try {
    const [currentAccounts, legacyAccounts] = await Promise.all([
      getProgramAccounts(DECISION_ACCOUNT_SIZE),
      getProgramAccounts(LEGACY_DECISION_ACCOUNT_SIZE),
    ]);

    const decisions = [...currentAccounts, ...legacyAccounts]
      .map(decodeDecision)
      .sort((a, b) => b.decisionIndex - a.decisionIndex)
      .slice(0, 12);

    setCache({ decisions, timestamp: now });

    res.setHeader("cache-control", "no-store");
    res.status(200).json({ decisions, count: decisions.length });
  } catch (error: any) {
    // RPC failed (almost always 429 on public devnet). If we have any cached
    // payload at all, serve it — UI stays alive, judges don't see error
    // states during a demo. Only return 500 if we've never succeeded.
    const stale = getCache();
    if (stale) {
      console.warn(
        "[fornex] /api/decisions: RPC failed, serving stale cache:",
        error?.message
      );
      res.setHeader("cache-control", "no-store");
      res.status(200).json({
        decisions: stale.decisions,
        count: stale.decisions.length,
        stale: true,
      });
      return;
    }
    console.error("[fornex] /api/decisions failed:", error);
    res.status(503).json({ error: error?.message || "Failed to load decisions" });
  }
}
