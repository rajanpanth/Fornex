import { useEffect, useState } from "react";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  Activity,
  CircleDollarSign,
  Coins,
  Cpu,
  Hash,
  Network,
} from "lucide-react";
import {
  PROGRAM_ID,
  RPC_URL,
  VAULT_ADDRESS,
  decodeVault,
} from "../lib/chain";

const PROGRAM_ID_STRING = PROGRAM_ID.toBase58();
const PROGRAM_ID_SHORT = `${PROGRAM_ID_STRING.slice(0, 4)}…${PROGRAM_ID_STRING.slice(-4)}`;

type LiveTrust = {
  decisionCount: number | null;
  navSol: number | null;
  trades: number | null;
  executedTrades: number | null;
};

const INITIAL: LiveTrust = {
  decisionCount: null,
  navSol: null,
  trades: null,
  executedTrades: null,
};

export default function TrustStrip({
  variant = "landing",
}: {
  variant?: "landing" | "app";
}) {
  const [data, setData] = useState<LiveTrust>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    let connection: Connection | null = null;

    async function fetchTrust() {
      try {
        // Decisions: route through Next API which caches and uses the same
        // RPC. This avoids hammering devnet with getProgramAccounts from
        // every browser tab in parallel with the other on-page fetchers.
        const decisionRes = await fetch("/api/decisions", { cache: "no-store" });
        let decisionCount: number | null = null;
        if (decisionRes.ok) {
          const json = (await decisionRes.json()) as {
            decisions?: Array<unknown>;
            count?: number;
          };
          decisionCount =
            typeof json.count === "number"
              ? json.count
              : Array.isArray(json.decisions)
              ? json.decisions.length
              : null;
        }

        // Vault: cheap single account read.
        if (!connection) connection = new Connection(RPC_URL, "confirmed");
        const vaultInfo = await connection
          .getAccountInfo(VAULT_ADDRESS)
          .catch(() => null);

        if (cancelled) return;

        let navSol: number | null = null;
        let trades: number | null = null;
        let executedTrades: number | null = null;
        if (vaultInfo) {
          try {
            const vault = decodeVault(Buffer.from(vaultInfo.data));
            navSol = Number(vault.nav) / LAMPORTS_PER_SOL;
            trades = vault.tradeCount;
            executedTrades = vault.executedTradeCount;
          } catch {
            /* swallow decode errors */
          }
        }

        setData((prev) => ({
          decisionCount: decisionCount ?? prev.decisionCount,
          navSol: navSol ?? prev.navSol,
          trades: trades ?? prev.trades,
          executedTrades: executedTrades ?? prev.executedTrades,
        }));
      } catch {
        /* silent — keep stale state */
      }
    }

    // Stagger first call by 3s so we don't fight useVault/useDecisions
    // /EquityCurve for the same RPC tokens on page load.
    const initial = window.setTimeout(() => void fetchTrust(), 3_000);
    const interval = window.setInterval(() => void fetchTrust(), 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const earningsSol =
    data.executedTrades !== null ? (data.executedTrades * 0.001).toFixed(3) : null;

  const items: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
    href?: string;
    mono?: boolean;
  }> = [
    {
      icon: <Hash size={13} aria-hidden="true" />,
      label: "Program",
      value: PROGRAM_ID_SHORT,
      href: `https://explorer.solana.com/address/${PROGRAM_ID_STRING}?cluster=devnet`,
      mono: true,
    },
    {
      icon: <Network size={13} aria-hidden="true" />,
      label: "Network",
      value: "Solana Devnet",
    },
    {
      icon: <Cpu size={13} aria-hidden="true" />,
      label: "Decisions",
      value: data.decisionCount !== null ? `${data.decisionCount}` : "—",
      mono: true,
    },
    {
      icon: <CircleDollarSign size={13} aria-hidden="true" />,
      label: "Vault NAV",
      value:
        data.navSol !== null
          ? `${data.navSol.toFixed(3)} SOL`
          : "—",
      mono: true,
    },
    {
      icon: <Activity size={13} aria-hidden="true" />,
      label: "Executed",
      value: data.executedTrades !== null ? `${data.executedTrades}` : "—",
      mono: true,
    },
    {
      icon: <Coins size={13} aria-hidden="true" />,
      label: "pay.sh earned",
      value: earningsSol !== null ? `${earningsSol} SOL` : "—",
      mono: true,
    },
  ];

  return (
    <div
      className={`trust-strip trust-strip--${variant}`}
      role="group"
      aria-label="Live protocol metrics"
    >
      {items.map((item, i) => {
        const inner = (
          <>
            <span className="trust-strip__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="trust-strip__label">{item.label}</span>
            <span
              className={`trust-strip__value ${item.mono ? "is-mono" : ""}`}
            >
              {item.value}
            </span>
          </>
        );

        return item.href ? (
          <a
            key={i}
            className="trust-strip__cell trust-strip__cell--link"
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        ) : (
          <div key={i} className="trust-strip__cell">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
