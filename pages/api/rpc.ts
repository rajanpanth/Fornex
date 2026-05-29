import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Server-side Solana JSON-RPC proxy.
 *
 * Browser components route their getProgramAccounts / getAccountInfo / etc.
 * through this endpoint so:
 *   1. The Helius API key (server-only env HELIUS_RPC_URL) never reaches the
 *      client bundle.
 *   2. We can pool requests and rate-limit them centrally.
 *   3. Cold devnet 429s are absorbed at the edge instead of breaking the UI.
 *
 * Cache window: 5s for read methods. JSON-RPC method names are deterministic
 * keys; params are stringified into the cache key.
 */

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

const CACHE_KEY = "__fornexRpcCache";
const CACHE_TTL_MS = 5_000;
const CACHEABLE_METHODS = new Set([
  "getAccountInfo",
  "getProgramAccounts",
  "getMultipleAccounts",
  "getRecentPrioritizationFees",
  "getLatestBlockhash",
  "getSlot",
]);

type CacheEntry = { body: string; status: number; ts: number };
function getCache(): Map<string, CacheEntry> {
  const g = globalThis as any;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map<string, CacheEntry>();
  return g[CACHE_KEY] as Map<string, CacheEntry>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const method: string | undefined = body?.method;
  const cacheKey =
    method && CACHEABLE_METHODS.has(method)
      ? `${method}:${JSON.stringify(body?.params ?? [])}`
      : null;

  if (cacheKey) {
    const hit = getCache().get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      res.setHeader("cache-control", "no-store");
      res.setHeader("x-fornex-cache", "HIT");
      return res.status(hit.status).send(hit.body);
    }
  }

  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();

    if (cacheKey && upstream.ok) {
      getCache().set(cacheKey, {
        body: text,
        status: upstream.status,
        ts: Date.now(),
      });
    }

    res.setHeader("cache-control", "no-store");
    res.setHeader("x-fornex-cache", "MISS");
    res.status(upstream.status).send(text);
  } catch (e: any) {
    res.status(502).json({ error: e?.message || "RPC proxy failure" });
  }
}
