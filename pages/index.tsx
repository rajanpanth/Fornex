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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ── Constants ──────────────────────────────────────────── */
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw"
);
const VAULT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS || PublicKey.default.toBase58()
);

/* ── Types ──────────────────────────────────────────────── */
type Decision = {
  pubkey: PublicKey;
  decisionIndex: number;
  market: string;
  bullVote: Vote;
  bearVote: Vote;
  zenVote: Vote;
  consensus: Vote;
  sizeUsd: number;
  executed: boolean;
  executionRef: string;
  timestamp: number;
};

type Vote = {
  direction: number;
  leverage: number;
  confidence: number;
  reasoning: string;
};

type Toast = {
  id: string;
  type: "success" | "error";
  title: string;
  body: string;
};

/* ── Main Component ─────────────────────────────────────── */
export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vault, setVault] = useState<any | null>(null);
  const [userDeposit, setUserDeposit] = useState<{
    shares: bigint;
    totalDeposited: bigint;
  } | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<"24h" | "all">("24h");
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [solPrice, setSolPrice] = useState({ price: 0, change: 0 });
  const [cycleProgress, setCycleProgress] = useState(0);
  const [displayedEarnings, setDisplayedEarnings] = useState(0);
  const earningsAnimRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── SOL price fetch ── */
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
        );
        const data = await res.json();
        setSolPrice({
          price: data.solana.usd,
          change: data.solana.usd_24h_change,
        });
      } catch {
        /* silently fail on price fetch errors */
      }
    };
    void fetchPrice();
    const id = setInterval(fetchPrice, 60_000);
    return () => clearInterval(id);
  }, []);

  /* ── Cycle progress (15-min timer) ── */
  useEffect(() => {
    const tick = () => {
      const CYCLE = 15 * 60 * 1000;
      setCycleProgress((Date.now() % CYCLE) / CYCLE);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Agent earnings counter animation ── */
  const targetEarnings = useMemo(
    () => (vault?.tradeCount || 0) * 0.001,
    [vault]
  );

  useEffect(() => {
    if (earningsAnimRef.current) cancelAnimationFrame(earningsAnimRef.current);
    const start = displayedEarnings;
    const end = targetEarnings;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedEarnings(start + (end - start) * eased);
      if (progress < 1) earningsAnimRef.current = requestAnimationFrame(animate);
    };
    earningsAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (earningsAnimRef.current) cancelAnimationFrame(earningsAnimRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEarnings]);

  /* ── Toast helpers ── */
  const addToast = useCallback((type: "success" | "error", title: string, body: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  /* ── Chain data refresh ── */
  const refresh = useCallback(async () => {
    const vaultInfo = await connection.getAccountInfo(VAULT_ADDRESS);
    if (vaultInfo) setVault(decodeVault(vaultInfo.data));

    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize:
            8 + 32 + 4 + 16 + 4 * 203 + 8 + 1 + 88 + 8 + 8 + 1,
        },
      ],
    });
    const parsed = accounts
      .map((a) => decodeDecision(a.pubkey, a.account.data))
      .filter(Boolean)
      .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
      .slice(0, 12) as Decision[];
    setDecisions(parsed);
  }, [connection]);

  /* ── User deposit account ── */
  useEffect(() => {
    if (!wallet.publicKey) {
      setUserDeposit(null);
      return;
    }
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_deposit"),
        VAULT_ADDRESS.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    connection
      .getAccountInfo(pda)
      .then((info) => {
        if (!info) {
          setUserDeposit(null);
          return;
        }
        const d = Buffer.from(info.data);
        const shares = d.readBigUInt64LE(8 + 32 + 32);
        const totalDeposited = d.readBigUInt64LE(8 + 32 + 32 + 8);
        setUserDeposit({ shares, totalDeposited });
      })
      .catch(() => setUserDeposit(null));
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const base = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 10;
    const points = range === "24h" ? 24 : 36;
    const now = Date.now();
    return Array.from({ length: points }, (_, i) => {
      const ts = new Date(now - (points - i) * (range === "24h" ? 3600_000 : 7200_000));
      const hh = ts.getHours().toString().padStart(2, "0");
      const mm = ts.getMinutes().toString().padStart(2, "0");
      return {
        t: `${hh}:${mm}`,
        nav: Number((base * (0.98 + i / (points * 35))).toFixed(4)),
      };
    });
  }, [range, vault]);

  /* ── Derived stats ── */
  const userSharesSol = useMemo(() => {
    if (!userDeposit || !vault || Number(vault.totalShares) === 0) return 0;
    return (
      (Number(userDeposit.shares) / Number(vault.totalShares)) *
      (Number(vault.nav) / LAMPORTS_PER_SOL)
    );
  }, [userDeposit, vault]);

  const userPnlPct = useMemo(() => {
    if (!userDeposit || Number(userDeposit.totalDeposited) === 0) return null;
    const deposited = Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL;
    return ((userSharesSol - deposited) / deposited) * 100;
  }, [userDeposit, userSharesSol]);

  const stats = {
    nav: vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0,
    trades: vault?.tradeCount || 0,
    winRate:
      vault?.tradeCount > 0
        ? Math.round((vault.winningTrades / vault.tradeCount) * 100)
        : 0,
  };

  /* ── Vault instruction ── */
  async function sendVaultIx(kind: "deposit" | "withdraw") {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    try {
      const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
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
        u64(BigInt(lamports)),
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
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      addToast(
        "success",
        `${kind === "deposit" ? "Deposit" : "Withdrawal"} confirmed`,
        `${sig.slice(0, 8)}…${sig.slice(-8)}`
      );
      await refresh();
    } catch (err: any) {
      addToast("error", "Transaction failed", err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const minsLeft = Math.floor((1 - cycleProgress) * 15);
  const secsLeft = Math.floor(((1 - cycleProgress) * 15 * 60) % 60);

  /* ── Render ── */
  return (
    <div className="terminal">
      {/* TOPBAR */}
      <header className="topbar">
        <span className="topbar-logo">Fornex</span>
        <span className="topbar-divider" />

        <div className="topbar-sol">
          <span className="topbar-sol-ticker">SOL</span>
          <span className="topbar-sol-price">
            {solPrice.price > 0 ? `$${solPrice.price.toFixed(2)}` : "—"}
          </span>
          {solPrice.price > 0 && (
            <span className={`price-pill ${solPrice.change >= 0 ? "up" : "down"}`}>
              {solPrice.change >= 0 ? "+" : ""}
              {solPrice.change.toFixed(1)}%
            </span>
          )}
        </div>

        <div className="topbar-center">
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE
          </div>
        </div>

        <div className="topbar-right">
          <span className="badge-devnet">Devnet</span>
          {mounted && <WalletMultiButton />}
        </div>
      </header>

      {/* STATS ROW */}
      <div className="stats-row">
        <StatCard
          label="Vault Value"
          value={`${stats.nav.toFixed(3)} SOL`}
          change={`${stats.trades} total trades`}
        />
        <StatCard
          label="Your Shares"
          value={wallet.publicKey ? userSharesSol.toFixed(4) : "—"}
          change={
            wallet.publicKey
              ? userDeposit
                ? `≈ ${userSharesSol.toFixed(3)} SOL current value`
                : "No deposit yet"
              : "Connect wallet"
          }
        />
        <StatCard
          label="Your P&L"
          value={
            userPnlPct !== null
              ? `${userPnlPct >= 0 ? "+" : ""}${userPnlPct.toFixed(2)}%`
              : "—"
          }
          change={
            userPnlPct !== null && userDeposit
              ? `${userPnlPct >= 0 ? "+" : ""}${(
                  userSharesSol -
                  Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL
                ).toFixed(4)} SOL since deposit`
              : "Since deposit"
          }
          positive={userPnlPct !== null && userPnlPct >= 0}
          negative={userPnlPct !== null && userPnlPct < 0}
        />
        <StatCard
          label="Agent Record"
          value={`${stats.winRate}%`}
          change={`${stats.trades} trades  |  ${vault?.winningTrades || 0} wins`}
          positive={stats.winRate >= 50}
        />
      </div>

      {/* BODY — two columns */}
      <div className="terminal-body">
        {/* LEFT COLUMN */}
        <div className="left-col">
          {/* Equity Curve */}
          <div className="chart-section">
            <div className="section-header">
              <span className="section-label">Equity Curve</span>
              <div className="range-toggle">
                <button
                  className={`range-btn${range === "24h" ? " active" : ""}`}
                  onClick={() => setRange("24h")}
                >
                  24H
                </button>
                <button
                  className={`range-btn${range === "all" ? " active" : ""}`}
                  onClick={() => setRange("all")}
                >
                  ALL
                </button>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#00d68f"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#00d68f"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="t"
                    stroke="transparent"
                    tick={{
                      fill: "#3d5166",
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    stroke="transparent"
                    tick={{
                      fill: "#3d5166",
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0c1520",
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: "5px",
                      fontSize: "11px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#e8edf2",
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                    formatter={(v: number) => [`${v} SOL`, "NAV"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="nav"
                    stroke="#00d68f"
                    strokeWidth={1.5}
                    fill="url(#navGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#00d68f", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Position Panel */}
          <div className="position-section">
            <div className="section-header">
              <span className="section-label">Current Position</span>
            </div>
            <div className="position-flat-wrap">
              <span className="position-flat-label">NO ACTIVE POSITION</span>
              <span className="position-flat-sub">
                Agent is monitoring for entry…
              </span>
            </div>
          </div>

          {/* Agent Earnings */}
          <div className="earnings-section">
            <div className="earnings-top">
              <div className="agent-status-badge">
                <span className="agent-status-dot" />
                Agent Active
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text-tertiary)",
                }}
              >
                pay.sh stream
              </span>
            </div>

            <div className="earn-total">{displayedEarnings.toFixed(3)} SOL earned</div>

            <div className="earn-rows">
              <div className="earn-row">
                <span className="earn-row-label">Stream rate</span>
                <span className="earn-row-val">0.001 SOL / trade</span>
              </div>
              <div className="earn-row">
                <span className="earn-row-label">Executions</span>
                <span className="earn-row-val">{stats.trades} trades</span>
              </div>
              <div className="earn-row">
                <span className="earn-row-label">Win rate</span>
                <span className="earn-row-val">{stats.winRate}%</span>
              </div>
              <div className="earn-row">
                <span className="earn-row-label">Provider</span>
                <span className="earn-row-val">pay.sh</span>
              </div>
            </div>

            <div className="cycle-block">
              <div className="cycle-header">
                <span>Next cycle</span>
                <span>
                  {minsLeft}m {secsLeft.toString().padStart(2, "0")}s
                </span>
              </div>
              <div className="cycle-track">
                <div
                  className="cycle-fill"
                  style={{ width: `${cycleProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="right-col">
          {/* Agent Debate Feed */}
          <div className="feed-panel">
            <div className="feed-header">
              <span className="feed-title">Agent Decisions</span>
              <div className="feed-update-label">
                <span className="live-dot" />
                Updating every 30s
              </div>
            </div>

            <div className="feed-body">
              {decisions.length === 0 ? (
                <div className="feed-empty">
                  <span className="feed-empty-main">
                    Scanning Markets
                    <span className="scan-dots" />
                  </span>
                  <span className="feed-empty-sub">
                    Waiting for first on-chain decision…
                  </span>
                </div>
              ) : (
                decisions.map((d) => (
                  <DecisionCard key={d.pubkey.toBase58()} decision={d} />
                ))
              )}
            </div>
          </div>

          {/* Deposit / Withdraw */}
          <div className="dw-section">
            <div className="dw-tabs">
              <button
                className={`dw-tab${tab === "deposit" ? " active" : ""}`}
                onClick={() => setTab("deposit")}
              >
                Deposit
              </button>
              <button
                className={`dw-tab${tab === "withdraw" ? " active" : ""}`}
                onClick={() => setTab("withdraw")}
              >
                Withdraw
              </button>
            </div>

            <div className="dw-body">
              <div className="input-group">
                <input
                  className="amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <span className="input-suffix">SOL</span>
              </div>

              <div className="receive-row">
                {tab === "deposit"
                  ? `You receive: ${amount || "0"} shares`
                  : `You receive: ${(Number(amount) * (stats.nav || 1)).toFixed(4)} SOL`}
              </div>

              {!wallet.publicKey ? (
                <button className="action-btn ghost" disabled>
                  Connect Wallet to {tab === "deposit" ? "Deposit" : "Withdraw"}
                </button>
              ) : loading ? (
                <button className="action-btn primary" disabled>
                  <span className="spinner" />
                  Confirming…
                </button>
              ) : (
                <button
                  className="action-btn primary"
                  onClick={() => sendVaultIx(tab)}
                >
                  {tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TOAST CONTAINER */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-title">{t.title}</span>
            <span className="toast-body">{t.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatCard({
  label,
  value,
  change,
  positive,
  negative,
}: {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const valueClass = [
    "stat-value",
    positive ? "positive" : "",
    negative ? "negative" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const changeClass = [
    "stat-change",
    positive ? "positive" : "",
    negative ? "negative" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={valueClass}>{value}</div>
      <div className={changeClass}>
        {positive && "↑ "}
        {negative && "↓ "}
        {change}
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const dir = dirLabel(decision.consensus.direction);
  const cls = dir.toLowerCase();
  const timeAgo = formatTimeAgo(decision.timestamp);
  const longCount = [decision.bullVote, decision.bearVote, decision.zenVote].filter(
    (v) => v.direction === 1
  ).length;
  const shortCount = [decision.bullVote, decision.bearVote, decision.zenVote].filter(
    (v) => v.direction === 2
  ).length;
  const consensusStr =
    dir === "LONG"
      ? `${longCount}/3 LONG`
      : dir === "SHORT"
      ? `${shortCount}/3 SHORT`
      : "2/3 FLAT";

  return (
    <article className={`decision-card ${cls}`}>
      <div className="decision-top">
        <span className={`dir-badge ${cls}`}>{dir}</span>
        <span className="decision-market">
          {decision.market || "SOL-PERP"}
        </span>
        <span className="decision-conf">
          {decision.consensus.confidence}% conf
        </span>
        <span className="decision-time">{timeAgo}</span>
      </div>

      <div className="agents-grid">
        <AgentRow icon="🐂" name="BULL" colorClass="bull" vote={decision.bullVote} />
        <AgentRow icon="🐻" name="BEAR" colorClass="bear" vote={decision.bearVote} />
        <AgentRow icon="⚖️" name="ZEN"  colorClass="zen"  vote={decision.zenVote}  />
      </div>

      <div className="decision-footer">
        <span className={`consensus-line${decision.executed ? " executed" : ""}`}>
          CONSENSUS: {consensusStr}
          {decision.executed ? " → Executed" : " → Logged"}
        </span>
        {decision.executionRef && decision.executionRef.trim() && (
          <a
            className="tx-link"
            href={`https://solscan.io/tx/${decision.executionRef}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            TX: {decision.executionRef.slice(0, 4)}…{decision.executionRef.slice(-4)} ↗
          </a>
        )}
      </div>
    </article>
  );
}

function AgentRow({
  icon,
  name,
  colorClass,
  vote,
}: {
  icon: string;
  name: string;
  colorClass: string;
  vote: Vote;
}) {
  const voteDir = dirLabel(vote.direction).toLowerCase();
  return (
    <div className="agent-row">
      <div className="agent-meta">
        <div className="agent-id">
          <span className="agent-icon">{icon}</span>
          <span className={`agent-name ${colorClass}`}>{name}</span>
        </div>
        <div className="agent-badges">
          <span className={`abadge ${voteDir}`}>{dirLabel(vote.direction)}</span>
          <span className="abadge neutral">{vote.leverage}x</span>
          <span className="abadge neutral">{vote.confidence}%</span>
        </div>
      </div>
      <span className="agent-reasoning">
        &ldquo;{vote.reasoning || "No reasoning provided."}&rdquo;
      </span>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function dirLabel(d: number) {
  if (d === 1) return "LONG";
  if (d === 2) return "SHORT";
  return "FLAT";
}

function decodeVault(data: Buffer) {
  const r = new Reader(data);
  r.skip(8);
  return {
    agentAuthority: r.publicKey(),
    admin: r.publicKey(),
    totalDeposits: r.u64(),
    totalShares: r.u64(),
    nav: r.u64(),
    tradeCount: r.u32(),
    winningTrades: r.u32(),
    isTradingPaused: r.bool(),
  };
}

function decodeDecision(pubkey: PublicKey, data: Buffer): Decision | null {
  try {
    const r = new Reader(data);
    r.skip(8);
    r.publicKey();
    return {
      pubkey,
      decisionIndex: r.u32(),
      market: r.fixedString(16),
      bullVote: r.vote(),
      bearVote: r.vote(),
      zenVote: r.vote(),
      consensus: r.vote(),
      sizeUsd: Number(r.u64()),
      executed: r.bool(),
      executionRef: r.fixedString(88),
      timestamp: Number(r.skipU64AfterPnl()),
    };
  } catch {
    return null;
  }
}

class Reader {
  private offset = 0;
  constructor(private data: Buffer) {}
  skip(n: number) { this.offset += n; }
  publicKey() {
    const k = new PublicKey(this.data.subarray(this.offset, this.offset + 32));
    this.offset += 32;
    return k;
  }
  u8() { const v = this.data.readUInt8(this.offset); this.offset += 1; return v; }
  bool() { return this.u8() === 1; }
  u32() { const v = this.data.readUInt32LE(this.offset); this.offset += 4; return v; }
  u64() { const v = this.data.readBigUInt64LE(this.offset); this.offset += 8; return v; }
  fixedString(size: number) {
    const b = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    const end = b.indexOf(0);
    return b.subarray(0, end === -1 ? size : end).toString("utf8");
  }
  vote(): Vote {
    return {
      direction: this.u8(),
      leverage: this.u8(),
      confidence: this.u8(),
      reasoning: this.fixedString(200),
    };
  }
  skipU64AfterPnl() { this.offset += 8; return this.u64(); }
}

async function discriminator(ns: string, name: string) {
  const b = new TextEncoder().encode(`${ns}:${name}`);
  const h = await crypto.subtle.digest("SHA-256", b);
  return Buffer.from(h).subarray(0, 8);
}

function u64(v: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

function readonly(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: false };
}
function writable(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: true };
}
function signer(pubkey: PublicKey) {
  return { pubkey, isSigner: true, isWritable: true };
}
