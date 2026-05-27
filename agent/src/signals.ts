import { PublicKey } from "@solana/web3.js";
import { signalsConnection, SIGNALS_DRIFT_ENV } from "./config";
import type { MarketSignals } from "./types";

const SOL_PERP_MARKET_INDEX = 0;
const FUNDING_RATE_PRECISION = 1e9;
const oiHistory: Array<{ value: number; ts: number }> = [];

export async function fetchSignals(): Promise<MarketSignals> {
  const timestamp = Date.now();

  try {
    const drift = await import("@drift-labs/sdk");
    const wallet = readOnlyWallet();
    const driftClient = new (drift as any).DriftClient({
      connection: signalsConnection,
      wallet,
      env: SIGNALS_DRIFT_ENV,
    });

    await driftClient.subscribe();
    try {
      const perpMarket = driftClient.getPerpMarketAccount(SOL_PERP_MARKET_INDEX);
      const oracleData = driftClient.getOracleDataForPerpMarket(
        SOL_PERP_MARKET_INDEX
      );

      const markPrice = numberFromDrift(
        driftClient.getMarkPriceData?.(SOL_PERP_MARKET_INDEX)?.price ??
          perpMarket?.amm?.lastMarkPriceTwap ??
          oracleData?.price
      );
      const indexPrice = numberFromDrift(oracleData?.price) || markPrice;
      const currentPrice = markPrice || indexPrice;
      const fundingRate = getFundingRate(driftClient, perpMarket);
      const openInterest = getOpenInterest(perpMarket);
      const oiChange = getOiChange(openInterest, timestamp);
      const { longBase, shortBase } = getLongShortBase(perpMarket);
      const lsRatio = shortBase > 0 ? longBase / shortBase : longBase > 0 ? 99 : 1;
      const markIndexSpread =
        indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : 0;
      const liqWallPrice = await estimateLiquidationWall(
        driftClient,
        currentPrice
      );

      return {
        fundingRate,
        oiChange,
        lsRatio: round(lsRatio),
        markIndexSpread: round(markIndexSpread),
        liqWallPrice: round(liqWallPrice),
        currentPrice: round(currentPrice),
        timestamp,
      };
    } finally {
      await driftClient.unsubscribe?.();
    }
  } catch (error) {
    console.warn("[signals] Drift fetch failed; using safe defaults", error);
    return await safeDefaults(timestamp);
  }
}

async function fetchSolPriceUSD(): Promise<number> {
  // Coingecko is rate-limited but free and works fine for a 15-minute cycle.
  // If it fails we fall back to a known recent value so agents never see $0.
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { solana?: { usd?: number } };
    return Number(json?.solana?.usd) || 0;
  } catch {
    return 0;
  }
}

function safeDefaults(timestamp: number): Promise<MarketSignals> {
  return fetchSolPriceUSD().then((price) => ({
    fundingRate: 0,
    oiChange: 0,
    lsRatio: 1,
    markIndexSpread: 0,
    liqWallPrice: round((price || 150) * 0.92),
    currentPrice: round(price || 150),
    timestamp,
  }));
}

function readOnlyWallet() {
  const publicKey = PublicKey.default;
  return {
    publicKey,
    signTransaction: async () => {
      throw new Error("read-only wallet cannot sign");
    },
    signAllTransactions: async () => {
      throw new Error("read-only wallet cannot sign");
    },
  };
}

function numberFromDrift(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value / 1e6;
  if (typeof value.toNumber === "function") return value.toNumber() / 1e6;
  return Number(value) / 1e6 || 0;
}

function getFundingRate(driftClient: any, perpMarket: any): number {
  try {
    const rawRate =
      driftClient.getFundingRate?.(SOL_PERP_MARKET_INDEX) ??
      perpMarket?.amm?.lastFundingRate ??
      0;
    const hourlyPct = (rawNumber(rawRate) / FUNDING_RATE_PRECISION) * 100;
    return round(hourlyPct);
  } catch {
    return 0;
  }
}

function rawNumber(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function getOpenInterest(perpMarket: any): number {
  const base =
    perpMarket?.amm?.baseAssetAmountWithAmm ??
    perpMarket?.amm?.baseAssetAmountLong ??
    0;
  return Math.abs(numberFromDrift(base));
}

function getOiChange(openInterest: number, now: number): number {
  // Add current reading
  oiHistory.push({ value: openInterest, ts: now });

  // Trim entries older than 24 hours
  const cutoff = now - 24 * 60 * 60 * 1000;
  while (oiHistory.length > 0 && oiHistory[0].ts < cutoff) {
    oiHistory.shift();
  }

  // Find the most recent reading at least 1 hour old
  const oneHourAgo = now - 60 * 60 * 1000;
  let ref = oiHistory[0];
  for (const entry of oiHistory) {
    if (entry.ts <= oneHourAgo) {
      ref = entry;
    } else {
      break;
    }
  }

  if (!ref || ref.value === 0) return 0;
  return round(((openInterest - ref.value) / ref.value) * 100);
}

function getLongShortBase(perpMarket: any) {
  const longBase = Math.abs(numberFromDrift(perpMarket?.amm?.baseAssetAmountLong));
  const shortBase = Math.abs(
    numberFromDrift(perpMarket?.amm?.baseAssetAmountShort)
  );
  return { longBase, shortBase };
}

async function estimateLiquidationWall(
  driftClient: any,
  currentPrice: number
): Promise<number> {
  try {
    const users = await driftClient.getUserMap?.();
    const buckets = new Map<number, number>();
    for (const user of users?.values?.() ?? []) {
      const position = user
        ?.getUserAccount?.()
        ?.perpPositions?.find((p: any) => p.marketIndex === SOL_PERP_MARKET_INDEX);
      const liqPrice = numberFromDrift(
        user?.liquidationPrice?.(SOL_PERP_MARKET_INDEX) ??
          user?.getLiquidationPrice?.(SOL_PERP_MARKET_INDEX)
      );
      const size = Math.abs(numberFromDrift(position?.baseAssetAmount));
      if (liqPrice > 0 && size > 0) {
        const bucket = Math.round(liqPrice);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + size);
      }
    }
    return [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currentPrice * 0.9;
  } catch {
    return currentPrice > 0 ? currentPrice * 0.9 : 0;
  }
}

function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

if (require.main === module) {
  fetchSignals()
    .then((signals) => {
      console.log("signals:", signals);
      console.log(`fundingRate: ${signals.fundingRate}%/hr`);
    })
    .catch((error) => {
      console.error("[signals] test failed", error);
      process.exit(1);
    });
}
