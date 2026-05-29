import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import {
  BarChart3,
  BrainCircuit,
  Landmark,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

import {
  PROGRAM_ID,
  VAULT_ADDRESS,
  VAULT_MINT_ADDRESS,
  discriminator,
  u64,
  readonly,
  writable,
  signer,
} from "../lib/chain";
import { useVault } from "../hooks/useVault";
import { useDecisions } from "../hooks/useDecisions";
import { usePosition } from "../hooks/usePosition";
import { useAgentCycle } from "../hooks/useAgentCycle";
import { usePriorityFee } from "../hooks/usePriorityFee";

import VaultStats from "../components/VaultStats";
import PositionPanel from "../components/PositionPanel";
import DepositPanel from "../components/DepositPanel";
import DebateFeed from "../components/DebateFeed";
import EquityCurve from "../components/EquityCurve";
import AgentPerformanceChart from "../components/AgentPerformanceChart";
import AgentEarnings from "../components/AgentEarnings";
import StrategyOrdersPanel from "../components/StrategyOrdersPanel";
import ToastContainer, { useToasts } from "../components/Toast";
import StatusBar from "../components/StatusBar";
import WalletDisconnected from "../components/WalletDisconnected";
import RiskStatusCard from "../components/RiskStatusCard";
import AgentReputationCard from "../components/AgentReputationCard";
import StrategyModeBadge from "../components/StrategyModeBadge";
import RiskDashboard from "../components/RiskDashboard";

// Lazy import keeps the initial paint snappy and avoids running its RPC fetch in SSR.
const TrustStripLazy = dynamic(() => import("../components/TrustStrip"), {
  ssr: false,
  loading: () => <div className="app-trust__skeleton" aria-hidden="true" />,
});

export default function AppDashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState({ price: 0, change: 0 });
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [fnrxBalance, setFnrxBalance] = useState<number | null>(null);
  const [newDecisionAlert, setNewDecisionAlert] = useState(false);
  const [mobileTab, setMobileTab] = useState<"vault" | "feed" | "trade" | "stats">("vault");
  const [statsTab, setStatsTab] = useState<"stats" | "risk" | "performance">("stats");
  const { level: priorityFee, setLevel: setPriorityFee, currentFee } = usePriorityFee();

  useEffect(() => { setMounted(true); }, []);

  // Hooks
  const { vault, nav, trades, executedTrades, winRate, inceptionNavSol, refresh } = useVault();
  const { decisions, refresh: refreshDecisions } = useDecisions();
  const { userDeposit, userSharesSol, userPnlPct } = usePosition(vault);
  const { toasts, addToast, removeToast } = useToasts();
  // Anchor the cycle countdown to the most recent on-chain decision so every
  // timer on the page (topbar pill, right column, hero ticker) agrees with
  // what's actually on chain. Multiplied by 1000 because Solana stores i64
  // unix seconds; JS wants ms.
  const lastDecisionMs =
    decisions.length > 0 && decisions[0].timestamp > 0
      ? decisions[0].timestamp * 1000
      : null;
  const cycle = useAgentCycle(refreshDecisions, lastDecisionMs);

  // Re-fetch immediately when navigating to this page client-side
  // (handles the case where the initial hook effects fired before RPC was ready)
  useEffect(() => {
    const onRouteChange = () => {
      void refresh();
      void refreshDecisions();
    };
    router.events.on("routeChangeComplete", onRouteChange);
    return () => router.events.off("routeChangeComplete", onRouteChange);
  }, [router.events, refresh, refreshDecisions]);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event) => {
      const newDecisions = JSON.parse(event.data);
      if (Array.isArray(newDecisions) && newDecisions.length > 0) {
        refreshDecisions();
        setNewDecisionAlert(true);
        window.setTimeout(() => setNewDecisionAlert(false), 3000);
      }
    };
    const poll = window.setInterval(refreshDecisions, 30_000);
    return () => {
      eventSource.close();
      window.clearInterval(poll);
    };
  }, [refreshDecisions]);

  const refreshFnrxBalance = useCallback(async () => {
    if (!wallet.publicKey) {
      setFnrxBalance(null);
      return;
    }
    const balance = await getFnrxBalance(connection, wallet.publicKey);
    setFnrxBalance(balance);
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    void refreshFnrxBalance();
    const id = setInterval(() => void refreshFnrxBalance(), 15_000);
    return () => clearInterval(id);
  }, [refreshFnrxBalance]);

  // SOL price fetch
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
        );
        const data = await res.json();
        setSolPrice((prev) => {
          const next = {
          price: data.solana.usd,
          change: data.solana.usd_24h_change,
          };
          if (prev.price && next.price !== prev.price) {
            setPriceFlash(next.price > prev.price ? "up" : "down");
            window.setTimeout(() => setPriceFlash(null), 450);
          }
          return next;
        });
      } catch {
        /* silently fail */
      }
    };
    void fetchPrice();
    const id = setInterval(fetchPrice, 30_000);
    return () => clearInterval(id);
  }, []);

  // Vault instruction
  const sendVaultIx = useCallback(
    async (kind: "deposit" | "withdraw", amount: string) => {
      if (!wallet.publicKey || !wallet.signTransaction) return;
      setLoading(true);
      try {
        const units = parseDecimalUnits(amount, 9);
        const estimatedSharesRaw =
          kind === "deposit"
            ? vault && vault.totalShares > 0n && vault.nav > 0n
              ? (units * vault.totalShares) / vault.nav
              : units
            : units;
        const estimatedSolOutRaw =
          kind === "withdraw" && vault && vault.totalShares > 0n
            ? (units * vault.nav) / vault.totalShares
            : 0n;
        const [userDepositPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("user_deposit"),
            VAULT_ADDRESS.toBuffer(),
            wallet.publicKey.toBuffer(),
          ],
          PROGRAM_ID
        );
        const userTokenAccount = await getAssociatedTokenAddress(
          VAULT_MINT_ADDRESS,
          wallet.publicKey
        );
        const data = Buffer.concat([
          await discriminator("global", kind),
          u64(units),
        ]);
        const keys =
          kind === "deposit"
            ? [
                writable(VAULT_ADDRESS),
                writable(VAULT_MINT_ADDRESS),
                writable(userTokenAccount),
                writable(userDepositPda),
                signer(wallet.publicKey),
                readonly(TOKEN_PROGRAM_ID),
                readonly(ASSOCIATED_TOKEN_PROGRAM_ID),
                readonly(SystemProgram.programId),
                readonly(SYSVAR_RENT_PUBKEY),
              ]
            : [
                writable(VAULT_ADDRESS),
                writable(VAULT_MINT_ADDRESS),
                writable(userTokenAccount),
                writable(userDepositPda),
                signer(wallet.publicKey),
                readonly(TOKEN_PROGRAM_ID),
                readonly(SystemProgram.programId),
              ];
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys,
          data,
        });
        const tx = new Transaction();
        if (currentFee > 0) {
          tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: currentFee,
            })
          );
        }
        tx.add(ix);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        if (kind === "deposit") {
          addToast(
            "success",
            "Deposit confirmed",
            `${formatTokenAmount(estimatedSharesRaw)} $FNRX tokens minted to your wallet.`,
            sig,
            {
              href: `https://explorer.solana.com/address/${userTokenAccount.toBase58()}?cluster=devnet`,
              label: "View $FNRX ATA ↗",
            }
          );
        } else {
          addToast(
            "success",
            "Withdrawal confirmed",
            `${formatTokenAmount(estimatedSharesRaw)} $FNRX burned. ${formatTokenAmount(estimatedSolOutRaw)} SOL returned.`,
            sig
          );
        }
        await refresh();
        await refreshFnrxBalance();
      } catch (err: any) {
        addToast("error", "Transaction failed", err?.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [wallet, connection, addToast, refresh, refreshFnrxBalance, currentFee, vault]
  );

  const isConnected = mounted && !!wallet.publicKey;

  return (
    <>
      <Head>
        <title>Fornex - Trading Vault Dashboard</title>
        <meta
          name="description"
          content="Fornex autonomous AI trading vault. View live agent decisions, vault NAV, and manage your position on Solana devnet."
        />
      </Head>

      <div className="app-layout">
        <div className="app-ambient" aria-hidden="true" />
        <div className="app-grid-bg" aria-hidden="true" />
        {/* ═══ TOPBAR ═══ */}
        <header className="app-topbar">
          <Link href="/" className="app-topbar-logo">
            FORNEX
          </Link>
          <span className="topbar-divider" />

          <div className={`topbar-market ${priceFlash ? `flash-${priceFlash}` : ""}`}>
            <span className="topbar-market-pair">SOL-PERP</span>
            <span className="topbar-market-price">
              SOL {solPrice.price > 0 ? `$${solPrice.price.toFixed(2)}` : "--"}
            </span>
            {solPrice.price > 0 && (
              <span
                className={`topbar-pill ${
                  solPrice.change >= 0 ? "up" : "down"
                }`}
              >
                {solPrice.change >= 0 ? "+" : ""}
                {solPrice.change.toFixed(1)}% {solPrice.change >= 0 ? "↑" : "↓"}
              </span>
            )}
          </div>

          <div className="app-topbar-center">
            <div className="live-indicator" role="status" aria-live="polite">
              <span className="live-dot" aria-hidden="true" />
              AGENT LIVE
            </div>
            <div className={`cycle-topbar ${cycle.thinking ? "thinking" : ""}`} aria-label={`Next agent decision in ${cycle.label}`}>
              {cycle.thinking ? "Thinking…" : `Next in ${cycle.label}`}
            </div>
            <div
              className={`risk-indicator ${vault?.isTradingPaused ? "is-paused" : ""}`}
              aria-label={`Risk level: ${vault?.isTradingPaused ? "paused" : "normal"}`}
            >
              <ShieldCheck size={11} aria-hidden="true" />
              RISK: {vault?.isTradingPaused ? "PAUSED" : "NORMAL"}
            </div>
            {newDecisionAlert && (
              <div className="new-decision-badge" role="alert">NEW DECISION</div>
            )}
          </div>

          <div className="app-topbar-right">
            <Link
              href="/proof"
              className="proof-nav-link"
              title="Wall of on-chain evidence"
            >
              On-Chain Proof ↗
            </Link>
            <StatusBar level={priorityFee} setLevel={setPriorityFee} />
            {mounted && <WalletMultiButton />}
          </div>
        </header>

        {/* Trust strip - desktop only, summarizes live protocol metrics */}
        <div className="app-trust">
          <TrustStripLazy />
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="app-grid">
          {/* LEFT COLUMN */}
          <div className="app-col-left">
            <div className={`mobile-panel mobile-trade ${mobileTab === "trade" ? "active" : ""}`}>
              {isConnected ? (
                <DepositPanel
                  walletConnected={!!wallet.publicKey}
                  loading={loading}
                  onSubmit={sendVaultIx}
                  nav={nav}
                  userSharesRaw={userDeposit?.shares ?? 0n}
                  priorityFee={priorityFee}
                  setPriorityFee={setPriorityFee}
                  currentFee={currentFee}
                />
              ) : (
                <WalletDisconnected />
              )}
              <PositionPanel />
              <RiskStatusCard vault={vault} />
              <StrategyModeBadge />
            </div>
            <div className={`mobile-panel mobile-vault ${mobileTab === "vault" ? "active" : ""}`}>
              <VaultStats
                vault={vault}
                nav={nav}
                trades={trades}
                executedTrades={executedTrades}
                winRate={winRate}
                inceptionNavSol={inceptionNavSol}
                userSharesSol={userSharesSol}
                userPnlPct={userPnlPct}
                userDeposit={userDeposit}
                fnrxBalance={fnrxBalance}
              />
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div className={`app-col-center mobile-panel mobile-feed ${mobileTab === "feed" ? "active" : ""}`}>
            <DebateFeed decisions={decisions} />
          </div>

          {/* RIGHT COLUMN */}
          <div className={`app-col-right mobile-panel mobile-stats ${mobileTab === "stats" ? "active" : ""}`}>
            <div className="stats-tabs" role="tablist" aria-label="Right column sections">
              {([
                ["stats", "Stats", BarChart3],
                ["risk", "Risk", ShieldCheck],
                ["performance", "Performance", BrainCircuit],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={statsTab === key}
                  className={`stats-tab ${statsTab === key ? "is-active" : ""}`}
                  onClick={() => setStatsTab(key)}
                  type="button"
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {/* Stats - agent earnings + reputation + latest signal */}
            <div
              className="stats-pane"
              role="tabpanel"
              hidden={statsTab !== "stats"}
            >
              <AgentEarnings trades={trades} executedTrades={executedTrades} winRate={winRate} cycle={cycle} />
              <AgentReputationCard />
              <StrategyOrdersPanel latestDecision={decisions[0] ?? null} />
            </div>

            {/* Risk - drawdown / HWM / streak / Sharpe-like + equity curve */}
            <div
              className="stats-pane"
              role="tabpanel"
              hidden={statsTab !== "risk"}
            >
              <RiskDashboard />
              <EquityCurve vault={vault} />
            </div>

            {/* Performance - agent decision distribution + equity curve */}
            <div
              className="stats-pane"
              role="tabpanel"
              hidden={statsTab !== "performance"}
            >
              <AgentPerformanceChart decisions={decisions} />
              <EquityCurve vault={vault} />
            </div>
          </div>
        </div>

        <nav className="mobile-tabbar" aria-label="Mobile dashboard sections">
          <button
            className={mobileTab === "vault" ? "active" : ""}
            onClick={() => setMobileTab("vault")}
          >
            <Landmark size={17} />
            Vault
          </button>
          <button
            className={mobileTab === "feed" ? "active" : ""}
            onClick={() => setMobileTab("feed")}
          >
            <BrainCircuit size={17} />
            Feed
          </button>
          <button
            className={mobileTab === "trade" ? "active" : ""}
            onClick={() => setMobileTab("trade")}
          >
            <Repeat2 size={17} />
            Trade
          </button>
          <button
            className={mobileTab === "stats" ? "active" : ""}
            onClick={() => setMobileTab("stats")}
          >
            <BarChart3 size={17} />
            Stats
          </button>
        </nav>
      </div>

      {/* TOASTS */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

// Defer trust strip to avoid blocking initial paint
function parseDecimalUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!normalized || normalized === ".") return 0n;

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const whole = wholePart.replace(/\D/g, "") || "0";
  const fraction = fractionPart
    .replace(/\D/g, "")
    .slice(0, decimals)
    .padEnd(decimals, "0");

  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction || "0");
}

async function getFnrxBalance(
  connection: Parameters<typeof getAccount>[0],
  walletPublicKey: PublicKey
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(VAULT_MINT_ADDRESS, walletPublicKey);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

function formatTokenAmount(rawAmount: bigint): string {
  return (Number(rawAmount) / LAMPORTS_PER_SOL).toFixed(4);
}
