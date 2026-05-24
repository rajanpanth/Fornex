import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { BarChart3, BrainCircuit, Landmark, Repeat2 } from "lucide-react";

import {
  PROGRAM_ID,
  VAULT_ADDRESS,
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
import ToastContainer, { useToasts } from "../components/Toast";

export default function AppDashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState({ price: 0, change: 0 });
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [mobileTab, setMobileTab] = useState<"vault" | "feed" | "trade" | "stats">("vault");

  useEffect(() => { setMounted(true); }, []);

  // Hooks
  const { vault, nav, trades, winRate, refresh } = useVault();
  const { decisions, refresh: refreshDecisions } = useDecisions();
  const { userDeposit, userSharesSol, userPnlPct } = usePosition(vault);
  const { toasts, addToast, removeToast } = useToasts();
  const cycle = useAgentCycle(refreshDecisions);

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
        const data = Buffer.concat([
          await discriminator("global", kind),
          u64(units),
        ]);
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            writable(VAULT_ADDRESS),
            writable(userDepositPda),
            signer(wallet.publicKey),
            readonly(SystemProgram.programId),
          ],
          data,
        });
        const tx = new Transaction().add(ix);
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
      } catch (err: any) {
        addToast("error", "Transaction failed", err?.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [wallet, connection, addToast, refresh]
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
            <div className="live-indicator">
              <span className="live-dot" />
              AGENT LIVE
            </div>
            <div className={`cycle-topbar ${cycle.thinking ? "thinking" : ""}`}>
              Next decision in {cycle.label}
            </div>
            <div className="risk-indicator">RISK: NORMAL</div>
          </div>

          <div className="app-topbar-right">
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
              />
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div className={`app-col-center mobile-panel mobile-feed ${mobileTab === "feed" ? "active" : ""}`}>
            <DebateFeed decisions={decisions} />
          </div>

          {/* RIGHT COLUMN */}
          <div className={`app-col-right mobile-panel mobile-stats ${mobileTab === "stats" ? "active" : ""}`}>
            <EquityCurve vault={vault} />
            <AgentPerformanceChart decisions={decisions} />
            <AgentEarnings trades={trades} winRate={winRate} cycle={cycle} />
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
