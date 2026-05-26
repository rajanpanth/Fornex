import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Buffer } from "buffer";
import { BarChart3, BrainCircuit, Landmark, Repeat2 } from "lucide-react";

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

import VaultStats from "../components/VaultStats";
import PositionPanel from "../components/PositionPanel";
import DepositPanel from "../components/DepositPanel";
import DebateFeed from "../components/DebateFeed";
import EquityCurve from "../components/EquityCurve";
import AgentPerformanceChart from "../components/AgentPerformanceChart";
import AgentEarnings from "../components/AgentEarnings";
import StrategyOrdersPanel from "../components/StrategyOrdersPanel";
import ToastContainer, { useToasts } from "../components/Toast";

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
  const [priorityFee, setPriorityFee] = useState<"DYNAMIC" | "FAST" | "TURBO">("DYNAMIC");
  const [feeDropdownOpen, setFeeDropdownOpen] = useState(false);
  const feeRef = useRef<HTMLDivElement>(null);
  const [pythStatus, setPythStatus] = useState<"UP" | "DOWN">("UP");
  const [rpcStatus, setRpcStatus] = useState<"UP" | "DOWN">("UP");
  const [mobileTab, setMobileTab] = useState<"vault" | "feed" | "trade" | "stats">("vault");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (feeRef.current && !feeRef.current.contains(e.target as Node)) {
        setFeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Hooks
  const { vault, nav, trades, winRate, refresh } = useVault();
  const { decisions, refresh: refreshDecisions } = useDecisions();
  const { userDeposit, userSharesSol, userPnlPct } = usePosition(vault);
  const { toasts, addToast, removeToast } = useToasts();
  const cycle = useAgentCycle(refreshDecisions);

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

  useEffect(() => {
    async function checkStatuses() {
      try {
        const [pyth, rpc] = await Promise.all([
          fetch(
            "https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
          ),
          connection.getLatestBlockhash(),
        ]);
        setPythStatus(pyth.ok ? "UP" : "DOWN");
        setRpcStatus(rpc.blockhash ? "UP" : "DOWN");
      } catch {
        setPythStatus("DOWN");
        setRpcStatus("DOWN");
      }
    }
    void checkStatuses();
    const id = window.setInterval(checkStatuses, 30_000);
    return () => window.clearInterval(id);
  }, [connection]);

  const refreshFnrxBalance = useCallback(async () => {
    if (!wallet.publicKey) {
      setFnrxBalance(null);
      return;
    }
    try {
      const ata = await getAssociatedTokenAddress(
        VAULT_MINT_ADDRESS,
        wallet.publicKey
      );
      const balance = await connection.getTokenAccountBalance(ata);
      setFnrxBalance(balance.value.uiAmount ?? 0);
    } catch {
      setFnrxBalance(0);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    void refreshFnrxBalance();
    const id = setInterval(() => void refreshFnrxBalance(), 30_000);
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
        const feeMicroLamports = await resolvePriorityFee(priorityFee, connection);
        if (feeMicroLamports > 0) {
          tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: feeMicroLamports,
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
        addToast(
          "success",
          `${kind === "deposit" ? "Deposit" : "Withdrawal"} confirmed`,
          `${sig.slice(0, 8)}…${sig.slice(-8)}`,
          sig
        );
        await refresh();
        await refreshFnrxBalance();
      } catch (err: any) {
        addToast("error", "Transaction failed", err?.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [wallet, connection, addToast, refresh, refreshFnrxBalance, priorityFee]
  );

  return (
    <>
      <Head>
        <title>Fornex Protocol — Trading Terminal</title>
        <meta
          name="description"
          content="Fornex autonomous AI trading terminal. View agent decisions, vault performance, and manage your position."
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
            <div className="risk-indicator" aria-label="Risk level: normal">RISK: NORMAL</div>
            {newDecisionAlert && (
              <div className="new-decision-badge" role="alert">NEW DECISION</div>
            )}
          </div>

          <div className="app-topbar-right">
            <div className="priority-fee" ref={feeRef}>
              <span className="label">Priority Fee:</span>
              <button
                className="fee-value"
                onClick={() => setFeeDropdownOpen(o => !o)}
                aria-expanded={feeDropdownOpen}
                aria-haspopup="listbox"
              >
                {priorityFee}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {feeDropdownOpen && (
                <div className="fee-dropdown" role="listbox">
                  {(["DYNAMIC", "FAST", "TURBO"] as const).map(opt => (
                    <button
                      key={opt}
                      role="option"
                      aria-selected={priorityFee === opt}
                      className={`fee-option${priorityFee === opt ? " active" : ""}`}
                      onClick={() => { setPriorityFee(opt); setFeeDropdownOpen(false); }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pyth-status">
              <span className={pythStatus === "UP" ? "green" : "red"}>●</span>
              Pyth {pythStatus}
            </div>
            <div className="pyth-status">
              <span className={rpcStatus === "UP" ? "green" : "red"}>●</span>
              Solana Devnet
            </div>
            <span className="badge-devnet">DEVNET</span>
            {mounted && <WalletMultiButton />}
          </div>
        </header>

        {/* ═══ MAIN GRID ═══ */}
        <div className="app-grid">
          {/* LEFT COLUMN */}
          <div className="app-col-left">
            <div className={`mobile-panel mobile-trade ${mobileTab === "trade" ? "active" : ""}`}>
              <DepositPanel
                walletConnected={!!wallet.publicKey}
                loading={loading}
                onSubmit={sendVaultIx}
                nav={nav}
                userSharesRaw={userDeposit?.shares ?? 0n}
              />
              <PositionPanel />
            </div>
            <div className={`mobile-panel mobile-vault ${mobileTab === "vault" ? "active" : ""}`}>
              <VaultStats
                vault={vault}
                nav={nav}
                trades={trades}
                winRate={winRate}
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
            <AgentEarnings trades={trades} winRate={winRate} cycle={cycle} />
            <AgentPerformanceChart decisions={decisions} />
            <EquityCurve vault={vault} />
            <StrategyOrdersPanel decision={decisions[0] ?? null} />
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

async function resolvePriorityFee(
  mode: "DYNAMIC" | "FAST" | "TURBO",
  connection: Connection
): Promise<number> {
  if (mode === "FAST") return 10_000;
  if (mode === "TURBO") return 100_000;
  try {
    const fees = await connection.getRecentPrioritizationFees();
    return Math.max(...fees.map((fee) => fee.prioritizationFee), 0);
  } catch {
    return 0;
  }
}

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
