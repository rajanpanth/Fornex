import { BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { connection, DRIFT_ENV, loadAgentKeypair } from "../config";
import type { CurrentPosition, Direction } from "../types";
import type { PerpExecutor } from "./types";

/**
 * FORNEX TRADING ARCHITECTURE:
 *
 * The agent wallet is a separate "trading wallet" funded with devnet SOL to
 * execute Drift Protocol perp positions. The vault PDA holds user deposits
 * and tracks NAV; after each trade cycle the agent calls update_nav() and
 * record_trade_outcome() to report realized PnL back on-chain.
 *
 * Real fund architecture:
 *   - Custody wallet (vault PDA) → holds deposits safely.
 *   - Trading wallet (agent)     → executes strategies on Drift.
 *   - NAV reconciliation         → bridges the two with bounded on-chain caps.
 *
 * Devnet path: agent wallet executes trades directly.
 * Mainnet plan: vault PDA performs CPI into Drift via signer seeds.
 */

const SOL_PERP_MARKET_INDEX = 0;
const USDC_SPOT_MARKET_INDEX = 0; // Drift devnet USDC spot market
const SOL_SPOT_MARKET_INDEX = 1;  // not used for collateral; reserved for future SOL deposit
const DRIFT_INIT_TIMEOUT_MS = 60_000;
const INITIAL_COLLATERAL_USDC = 100; // 100 USDC from Drift devnet faucet

/**
 * Drift devnet has a known SDK quirk where programmatic `deposit()` fails with
 * SpotMarketNotFound until the user account has been bootstrapped via the
 * Drift web UI. When DRIFT_SKIP_EXECUTION=1, we still initialize the user and
 * collect signals, but skip placePerpOrder so cycles complete cleanly without
 * burning compute on guaranteed-failing transactions.
 *
 * Set DRIFT_SKIP_EXECUTION=0 to attempt real orders (works once collateral is
 * deposited via app.drift.trade).
 */
const SKIP_DRIFT_EXECUTION = process.env.DRIFT_SKIP_EXECUTION !== "0";

let driftClient: any | null = null;
let driftUser: any | null = null;
let agentKeypair: Keypair | null = null;
let userInitialized = false;
let userInitAttempted = false;

export async function initExecutor(): Promise<void> {
  if (driftClient && userInitialized) return;
  if (driftClient && userInitAttempted && !userInitialized) return; // give up for this process
  if (SKIP_DRIFT_EXECUTION) {
    if (!userInitAttempted) {
      console.log(
        "[executor] DRIFT_SKIP_EXECUTION=1 — Drift order placement disabled. " +
          "Decisions will be logged on-chain with executed=false."
      );
      userInitAttempted = true;
    }
    return;
  }

  try {
    const drift = await withTimeout(
      import("@drift-labs/sdk"),
      DRIFT_INIT_TIMEOUT_MS,
      "Drift SDK import timed out"
    );
    agentKeypair = loadAgentKeypair();
    const wallet = {
      publicKey: agentKeypair.publicKey,
      signTransaction: async (tx: any) => {
        // Handle both legacy Transaction (partialSign) and VersionedTransaction
        // (sign). Drift SDK builds VersionedTransactions internally.
        if (typeof tx.partialSign === "function") {
          tx.partialSign(agentKeypair!);
        } else if (typeof tx.sign === "function") {
          tx.sign([agentKeypair!]);
        } else {
          throw new Error("Unknown transaction type passed to signTransaction");
        }
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) {
          if (typeof tx.partialSign === "function") {
            tx.partialSign(agentKeypair!);
          } else if (typeof tx.sign === "function") {
            tx.sign([agentKeypair!]);
          }
        }
        return txs;
      },
    };

    if (!driftClient) {
      driftClient = new (drift as any).DriftClient({
        connection,
        wallet,
        env: DRIFT_ENV,
        perpMarketIndexes: [SOL_PERP_MARKET_INDEX],
        spotMarketIndexes: [0, SOL_SPOT_MARKET_INDEX], // 0=USDC, 1=SOL
        accountSubscription: { type: "websocket" },
      });
      await withTimeout(
        driftClient.subscribe(),
        DRIFT_INIT_TIMEOUT_MS,
        "DriftClient.subscribe timed out"
      );
    }

    // Try to use an existing Drift user account; if none exists, create one
    // and deposit collateral so the agent can actually place orders.
    try {
      driftUser = driftClient.getUser?.() ?? null;
      if (driftUser) {
        await driftUser.fetchAccounts?.();
        userInitialized = true;
        // Force-include market accounts in every tx so we don't hit
        // SpotMarketNotFound / PerpMarketNotFound when the user has zero
        // positions (Drift devnet edge case).
        driftClient.mustIncludePerpMarketIndexes?.add(SOL_PERP_MARKET_INDEX);
        driftClient.mustIncludeSpotMarketIndexes?.add(USDC_SPOT_MARKET_INDEX);
        driftClient.mustIncludeSpotMarketIndexes?.add(SOL_SPOT_MARKET_INDEX);
        console.log(
          `[executor] Drift user ready: ${driftUser
            .getUserAccountPublicKey?.()
            ?.toBase58?.()}`
        );
      }
    } catch {
      driftUser = null;
    }

    if (!driftUser) {
      console.log(
        "[executor] No Drift user account; bootstrapping with mock USDC..."
      );
      userInitAttempted = true;
      try {
        const drift = await import("@drift-labs/sdk");
        const usdcAmount = new BN(Math.floor(INITIAL_COLLATERAL_USDC * 1e6)); // 6 decimals
        const usdcSpot = driftClient.getSpotMarketAccount?.(USDC_SPOT_MARKET_INDEX);
        if (!usdcSpot) throw new Error("USDC spot market not found in Drift devnet config");

        // Drift devnet mock-USDC faucet program (the one used by app.drift.trade
        // devnet "Get USDC" button). Pubkey is constant for devnet.
        const mockUsdcFaucetProgramId = new (await import("@solana/web3.js")).PublicKey(
          "V4v1mQiAdLz4qwckEb45WqHYceYizoib39cDBHSWfaB"
        );
        const faucet = new (drift as any).TokenFaucet(
          connection,
          { publicKey: agentKeypair.publicKey, signTransaction: wallet.signTransaction, signAllTransactions: wallet.signAllTransactions } as any,
          mockUsdcFaucetProgramId,
          usdcSpot.mint
        );

        // 1. Mint mock USDC into a fresh ATA owned by the agent
        try {
          const result: any = await withTimeout(
            faucet.createAssociatedTokenAccountAndMintTo(
              agentKeypair.publicKey,
              usdcAmount
            ),
            DRIFT_INIT_TIMEOUT_MS,
            "mock USDC mint timed out"
          );
          const usdcAta = result?.[0];
          const mintTx = result?.[1];
          console.log(`[executor] Minted ${INITIAL_COLLATERAL_USDC} mock USDC to ${usdcAta?.toBase58?.()} | tx: ${mintTx}`);
        } catch (e: any) {
          // ATA may already exist; mint into the existing one
          console.log(`[executor] mint+ata failed (${e?.message}); trying mintToUser into existing ATA`);
          try {
            const { getAssociatedTokenAddress } = await import("@solana/spl-token");
            const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, agentKeypair.publicKey);
            const tx = await faucet.mintToUser(usdcAta, usdcAmount);
            console.log(`[executor] Minted ${INITIAL_COLLATERAL_USDC} mock USDC | tx: ${tx}`);
          } catch (e2: any) {
            console.warn("[executor] mock USDC mint fallback failed:", e2?.message || e2);
          }
        }

        // 2. Try to attach to existing Drift user; if not present, init via devnet helper
        let userAlreadyExists = false;
        try {
          driftUser = driftClient.getUser?.() ?? null;
          await driftUser?.fetchAccounts?.();
          userAlreadyExists = !!driftUser;
        } catch {
          driftUser = null;
        }

        if (!userAlreadyExists) {
          try {
            const result: any = await withTimeout(
              driftClient.initializeUserAccountForDevnet(
                0,
                "Fornex Agent v1",
                USDC_SPOT_MARKET_INDEX,
                faucet,
                usdcAmount
              ),
              DRIFT_INIT_TIMEOUT_MS,
              "initializeUserAccountForDevnet timed out"
            );
            const initTx = result?.[0];
            const userPubkey = result?.[1];
            console.log(`[executor] Drift user init+deposit tx: ${initTx} | user: ${userPubkey?.toBase58?.()}`);
          } catch (e: any) {
            console.log("[executor] init+deposit skipped:", e?.message || e);
          }
        } else {
          console.log("[executor] Drift user already exists; depositing USDC directly...");
          try {
            const { getAssociatedTokenAddress } = await import("@solana/spl-token");
            const usdcAta = await getAssociatedTokenAddress(usdcSpot.mint, agentKeypair.publicKey);
            const depositTx = await withTimeout(
              driftClient.deposit(usdcAmount, USDC_SPOT_MARKET_INDEX, usdcAta),
              DRIFT_INIT_TIMEOUT_MS,
              "Drift USDC deposit timed out"
            );
            console.log(`[executor] Drift USDC deposit tx: ${depositTx}`);
          } catch (e: any) {
            console.warn("[executor] direct USDC deposit failed:", e?.message || e);
          }
        }

        // 3. Refresh and verify
        await driftClient.subscribe();
        try {
          driftUser = driftClient.getUser?.() ?? null;
          await driftUser?.fetchAccounts?.();
        } catch {
          driftUser = null;
        }
        userInitialized = !!driftUser;
        if (driftUser) {
          console.log(
            `[executor] Drift user ready: ${driftUser
              .getUserAccountPublicKey?.()
              ?.toBase58?.()}`
          );
        }
      } catch (e) {
        console.warn("[executor] Drift user bootstrap failed; trades will be skipped", e);
      }
    }
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
  if (SKIP_DRIFT_EXECUTION) {
    console.log(
      `[executor] DRIFT_SKIP_EXECUTION=1 — skipping ${direction} ${leverage}x order. ` +
        "Set DRIFT_SKIP_EXECUTION=0 after depositing USDC via app.drift.trade."
    );
    return null;
  }
  try {
    await initExecutor();
    if (!driftClient || !driftUser) {
      console.warn("[executor] openPosition skipped — no Drift user");
      return null;
    }

    const cappedLeverage = Math.min(3, Math.max(1, leverage));
    const oraclePrice = await getOraclePrice();
    const collateralUsd = collateralSOL * oraclePrice;
    const positionUsd = collateralUsd * cappedLeverage;
    const baseAssetAmount = new BN(Math.round((positionUsd / oraclePrice) * 1e9));
    const directionEnum = await orderDirection(direction);
    const orderParams = await marketOrderParams(directionEnum, baseAssetAmount);

    console.log(
      `[executor] placePerpOrder ${direction} ${cappedLeverage}x — ${positionUsd.toFixed(2)} USD notional`
    );
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
  if (SKIP_DRIFT_EXECUTION) return null;
  try {
    await initExecutor();
    const position = await getCurrentPosition();
    if (!driftClient || !driftUser || !position) return null;

    const beforeUnrealized = numberFromDrift(
      driftUser?.getUnrealizedPNL?.(true, SOL_PERP_MARKET_INDEX)
    );

    const closingDirection = position.direction === "LONG" ? "SHORT" : "LONG";
    const directionEnum = await orderDirection(closingDirection);
    const orderParams = await marketOrderParams(
      directionEnum,
      new BN(Math.abs(position.baseAssetAmount))
    );
    const txSig = await driftClient.placePerpOrder(orderParams);

    // Refresh and read the realized portion. Drift settles PnL on close, so
    // we use the pre-close unrealized estimate as the realized result.
    try {
      await driftUser.fetchAccounts?.();
    } catch {
      /* best-effort */
    }
    const settled =
      numberFromDrift(driftUser?.getSettledPerpPnl?.(SOL_PERP_MARKET_INDEX)) ??
      beforeUnrealized;

    return { txSig, realizedPnl: settled || beforeUnrealized || 0 };
  } catch (error) {
    console.warn("[executor] closePosition failed", error);
    return null;
  }
}

export async function getCurrentPosition(): Promise<CurrentPosition | null> {
  try {
    await initExecutor();
    let user = driftUser;
    if (!user && driftClient) {
      try {
        user = driftClient.getUser?.() ?? null;
      } catch {
        return null;
      }
    }
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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}


// ── Adapter wrapping the function-based Drift executor above ───────────

/**
 * Drift adapter. Status: SDK is wired and the agent's Drift sub-account is
 * live at 55pSF6jL6b5mMoiSjuMsbfD1PfJhTApLcBnPsZ3guHE2. As of May 2026
 * Drift devnet is in maintenance mode (April 2026 hack mitigation) so this
 * adapter is currently inactive by default. Set FORNEX_EXECUTOR=drift once
 * Drift devnet is back online.
 */
export class DriftExecutor implements PerpExecutor {
  readonly name = "drift";

  async init(): Promise<void> {
    await initExecutor();
  }

  async open(
    direction: Exclude<Direction, "FLAT">,
    leverage: number,
    collateralSOL: number
  ): Promise<string | null> {
    return openPosition(direction, leverage, collateralSOL);
  }

  async close(): Promise<{ txSig: string | null; realizedPnl: number } | null> {
    return closePosition();
  }

  async getCurrentPosition(): Promise<CurrentPosition | null> {
    return getCurrentPosition();
  }

  async shutdown(): Promise<void> {
    await shutdownExecutor();
  }
}
