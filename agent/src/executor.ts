import { BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { connection, DRIFT_ENV, loadAgentKeypair } from "./config";
import type { CurrentPosition, Direction } from "./types";

const SOL_PERP_MARKET_INDEX = 0;

let driftClient: any | null = null;
let driftUser: any | null = null;
let agentKeypair: Keypair | null = null;

export async function initExecutor(): Promise<void> {
  if (driftClient) return;

  try {
    const drift = await import("@drift-labs/sdk");
    agentKeypair = loadAgentKeypair();
    const wallet = {
      publicKey: agentKeypair.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(agentKeypair);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach((tx) => tx.partialSign(agentKeypair));
        return txs;
      },
    };

    driftClient = new (drift as any).DriftClient({
      connection,
      wallet,
      env: DRIFT_ENV,
    });
    await driftClient.subscribe();
    driftUser = driftClient.getUser?.();
  } catch (error) {
    console.warn("[executor] Drift initialization failed", error);
    driftClient = null;
  }
}

export async function openPosition(
  direction: Exclude<Direction, "FLAT">,
  leverage: number,
  collateralSOL: number
): Promise<string | null> {
  try {
    await initExecutor();
    if (!driftClient) return null;

    const cappedLeverage = Math.min(3, Math.max(1, leverage));
    const oraclePrice = await getOraclePrice();
    const collateralUsd = collateralSOL * oraclePrice;
    const positionUsd = collateralUsd * cappedLeverage;
    const baseAssetAmount = new BN(Math.round((positionUsd / oraclePrice) * 1e9));
    const directionEnum = await orderDirection(direction);
    const orderParams = await marketOrderParams(directionEnum, baseAssetAmount);

    return await driftClient.placePerpOrder(orderParams);
  } catch (error) {
    console.warn("[executor] openPosition failed", error);
    return null;
  }
}

export async function closePosition(): Promise<{
  txSig: string | null;
  realizedPnl: number;
} | null> {
  try {
    await initExecutor();
    const position = await getCurrentPosition();
    if (!driftClient || !position) return null;

    const closingDirection = position.direction === "LONG" ? "SHORT" : "LONG";
    const directionEnum = await orderDirection(closingDirection);
    const orderParams = await marketOrderParams(
      directionEnum,
      new BN(Math.abs(position.baseAssetAmount))
    );
    const txSig = await driftClient.placePerpOrder(orderParams);
    return { txSig, realizedPnl: position.unrealizedPnl || 0 };
  } catch (error) {
    console.warn("[executor] closePosition failed", error);
    return null;
  }
}

export async function getCurrentPosition(): Promise<CurrentPosition | null> {
  try {
    await initExecutor();
    const user = driftUser || driftClient?.getUser?.();
    const position = user
      ?.getUserAccount?.()
      ?.perpPositions?.find((p: any) => p.marketIndex === SOL_PERP_MARKET_INDEX);
    const base = Number(position?.baseAssetAmount?.toString?.() || 0);
    if (!base) return null;

    return {
      direction: base > 0 ? "LONG" : "SHORT",
      baseAssetAmount: base,
      quoteEntryAmount: Number(position?.quoteEntryAmount?.toString?.() || 0),
      entryPrice: numberFromDrift(user?.getEntryPrice?.(SOL_PERP_MARKET_INDEX)),
      leverage: numberFromDrift(user?.getLeverage?.()),
      unrealizedPnl: numberFromDrift(user?.getUnrealizedPNL?.(true, SOL_PERP_MARKET_INDEX)),
      liquidationPrice: numberFromDrift(user?.liquidationPrice?.(SOL_PERP_MARKET_INDEX)),
    };
  } catch (error) {
    console.warn("[executor] getCurrentPosition failed", error);
    return null;
  }
}

export async function getVaultPnL(): Promise<number> {
  try {
    const position = await getCurrentPosition();
    return position?.unrealizedPnl || 0;
  } catch (error) {
    console.warn("[executor] getVaultPnL failed", error);
    return 0;
  }
}

export async function shutdownExecutor(): Promise<void> {
  await driftClient?.unsubscribe?.();
}

async function getOraclePrice(): Promise<number> {
  const oracle = driftClient?.getOracleDataForPerpMarket?.(SOL_PERP_MARKET_INDEX);
  return numberFromDrift(oracle?.price) || 150;
}

async function orderDirection(direction: "LONG" | "SHORT") {
  const drift = await import("@drift-labs/sdk");
  return direction === "LONG"
    ? (drift as any).PositionDirection.LONG
    : (drift as any).PositionDirection.SHORT;
}

async function marketOrderParams(direction: any, baseAssetAmount: BN) {
  const drift = await import("@drift-labs/sdk");
  return (drift as any).getMarketOrderParams({
    marketIndex: SOL_PERP_MARKET_INDEX,
    direction,
    baseAssetAmount,
  });
}

function numberFromDrift(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value / 1e6;
  if (typeof value.toNumber === "function") return value.toNumber() / 1e6;
  return Number(value) / 1e6 || 0;
}

