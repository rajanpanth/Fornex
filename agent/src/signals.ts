import { PublicKey } from "@solana/web3.js";
import { connection, DRIFT_ENV } from "./config";
import type { MarketSignals } from "./types";

const SOL_PERP_MARKET_INDEX = 0;
const FUNDING_RATE_PRECISION = 1e9;
let previousOi: { value: number; timestamp: number } | null = null;

export async function fetchSignals(): Promise<MarketSignals> {
  const timestamp = Date.now();
  const fallback = safeDefaults(timestamp);

  try {
    const drift = await import("@drift-labs/sdk");
    const wallet = readOnlyWallet();
    const driftClient = new (drift as any).DriftClient({
      connection,
      wallet,
      env: DRIFT_ENV,
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
      const currentPrice = markPrice || indexPrice || fallback.currentPrice;
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
    return fallback;
  }
}

function safeDefaults(timestamp: number): MarketSignals {
  return {
    fundingRate: 0,
    oiChange: 0,
    lsRatio: 1,
    markIndexSpread: 0,
    liqWallPrice: 0,
    currentPrice: 0,
    timestamp,
  };
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

function getOiChange(openInterest: number, timestamp: number): number {
  if (!previousOi) {
    previousOi = { value: openInterest, timestamp };
    return 0;
  }
  const oneHourAgo = timestamp - 60 * 60 * 1000;
  const baseline = previousOi.timestamp <= oneHourAgo ? previousOi.value : previousOi.value;
  const change = baseline > 0 ? ((openInterest - baseline) / baseline) * 100 : 0;
  previousOi = { value: openInterest, timestamp };
  return round(change);
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
