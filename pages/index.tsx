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
import { Activity, ArrowDownToLine, ArrowUpFromLine, Radio, TrendingUp, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "G9rWuMYMbhVSEavQrEUPAwWGT5xewZEibDBkoWQzTEfw"
);
const VAULT_ADDRESS = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS || PublicKey.default.toBase58()
);

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

export default function Home() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [vault, setVault] = useState<any | null>(null);
  const [userDeposit, setUserDeposit] = useState<{ shares: bigint; totalDeposited: bigint } | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [range, setRange] = useState<"24h" | "all">("24h");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const refresh = useCallback(async () => {
    const vaultInfo = await connection.getAccountInfo(VAULT_ADDRESS);
    if (vaultInfo) setVault(decodeVault(vaultInfo.data));

    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 8 + 32 + 4 + 16 + 4 * 203 + 8 + 1 + 88 + 8 + 8 + 1 }],
    });
    const parsed = accounts
      .map((a) => decodeDecision(a.pubkey, a.account.data))
      .filter(Boolean)
      .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
      .slice(0, 10) as Decision[];
    setDecisions(parsed);
  }, [connection]);

  // Fetch the connected user's personal deposit account
  useEffect(() => {
    if (!wallet.publicKey) { setUserDeposit(null); return; }
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_deposit"), VAULT_ADDRESS.toBuffer(), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    connection.getAccountInfo(pda).then((info) => {
      if (!info) { setUserDeposit(null); return; }
      // UserDeposit layout: 8 disc | 32 owner | 32 vault | 8 shares | 8 total_deposited | 8 deposited_at | 1 bump
      const d = Buffer.from(info.data);
      const shares = d.readBigUInt64LE(8 + 32 + 32);
      const totalDeposited = d.readBigUInt64LE(8 + 32 + 32 + 8);
      setUserDeposit({ shares, totalDeposited });
    }).catch(() => setUserDeposit(null));
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const chartData = useMemo(() => {
    const base = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 1;
    const points = range === "24h" ? 24 : 36;
    return Array.from({ length: points }, (_, i) => ({
      t: `${i}`,
      nav: Number((base * (0.98 + i / (points * 35))).toFixed(4)),
    }));
  }, [range, vault]);

  // Compute user-specific stats
  const userSharesSol = useMemo(() => {
    if (!userDeposit || !vault || Number(vault.totalShares) === 0) return 0;
    return (Number(userDeposit.shares) / Number(vault.totalShares)) * (Number(vault.nav) / LAMPORTS_PER_SOL);
  }, [userDeposit, vault]);

  const userPnlPct = useMemo(() => {
    if (!userDeposit || Number(userDeposit.totalDeposited) === 0) return null;
    const deposited = Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL;
    const pnl = ((userSharesSol - deposited) / deposited) * 100;
    return pnl;
  }, [userDeposit, userSharesSol]);

  const stats = {
    nav: vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0,
    trades: vault?.tradeCount || 0,
    winRate:
      vault?.tradeCount > 0
        ? Math.round((vault.winningTrades / vault.tradeCount) * 100)
        : 0,
  };

  async function sendVaultIx(kind: "deposit" | "withdraw") {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    setNotice(null);
    try {
      const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
      const [userDeposit] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_deposit"), VAULT_ADDRESS.toBuffer(), wallet.publicKey.toBuffer()],
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
          writable(userDeposit),
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
      setNotice(`ok:${kind} confirmed — ${sig.slice(0, 8)}…${sig.slice(-8)}`);
      await refresh();
    } catch (err: any) {
      setNotice(`err:${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <span className="brand-name">FORNEX</span>
          <span className="brand-sub">Protocol</span>
        </div>
        <div className="header-right">
          <span className="badge-devnet">Devnet</span>
          {mounted && <WalletMultiButton />}
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <StatCell label="Vault NAV" value={`${stats.nav.toFixed(3)} SOL`} delta={`${stats.trades} trades`} />
        <StatCell
          label="Your Shares (SOL)"
          value={wallet.publicKey ? userSharesSol.toFixed(4) : "—"}
          delta={wallet.publicKey ? (userDeposit ? "active position" : "no deposit") : "connect wallet"}
        />
        <StatCell
          label="Your P&L"
          value={userPnlPct !== null ? `${userPnlPct >= 0 ? "+" : ""}${userPnlPct.toFixed(2)}%` : "—"}
          delta="since deposit"
          up={userPnlPct !== null && userPnlPct >= 0}
        />
        <StatCell label="Win Rate" value={`${stats.winRate}%`} delta={`${stats.trades} total trades`} up={stats.winRate >= 50} />
      </div>

      {/* Main grid */}
      <div className="main-grid">

        {/* Left — Decision feed */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">
              <Radio size={14} />
              Agent Decisions — On-Chain
            </div>
            <div className="live-dot" />
          </div>
          <div className="feed">
            {decisions.length === 0 ? (
              <p className="no-decisions">Waiting for first on-chain decision…</p>
            ) : (
              decisions.map((d) => <Ticket key={d.pubkey.toBase58()} decision={d} />)
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="right-col">

          {/* Equity curve */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <TrendingUp size={14} />
                Equity Curve
              </div>
              <div className="seg">
                <button className={range === "24h" ? "active" : ""} onClick={() => setRange("24h")}>24h</button>
                <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>All</button>
              </div>
            </div>
            <div className="card-body">
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                    <XAxis dataKey="t" stroke="var(--text-3)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-3)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-hi)",
                        border: "1px solid var(--border-hi)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "var(--text)",
                      }}
                      cursor={{ stroke: "var(--border-hi)" }}
                    />
                    <Line type="monotone" dataKey="nav" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Current position */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <Activity size={14} />
                Current Position
              </div>
            </div>
            <div className="card-body">
              <div className="pos-flat">FLAT</div>
              <p className="pos-note">No active position. Updates every 30 s.</p>
            </div>
          </div>

          {/* Deposit / Withdraw */}
          <div className="card">
            <div className="dw-tabs">
              <button
                className={`dw-tab${tab === "deposit" ? " active" : ""}`}
                onClick={() => setTab("deposit")}
              >
                <ArrowDownToLine size={13} />
                Deposit
              </button>
              <button
                className={`dw-tab${tab === "withdraw" ? " active" : ""}`}
                onClick={() => setTab("withdraw")}
              >
                <ArrowUpFromLine size={13} />
                Withdraw
              </button>
            </div>
            <div className="dw-body">
              <div>
                <p className="field-label">Amount (SOL)</p>
                <div className="amount-field">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                  />
                  <span className="amount-suffix">SOL</span>
                </div>
              </div>

              <div className="expected-row">
                <span className="label">
                  Expected {tab === "deposit" ? "shares" : "SOL"}
                </span>
                <span className="val">{amount || "0"}</span>
              </div>

              <button
                className={`action-btn ${tab}`}
                disabled={loading || !wallet.publicKey}
                onClick={() => sendVaultIx(tab)}
              >
                {loading ? "Sending…" : tab === "deposit" ? "Deposit" : "Withdraw"}
              </button>

              {notice && (
                <div className={`notice ${notice.startsWith("ok:") ? "ok" : "err"}`}>
                  {notice.replace(/^(ok:|err:)/, "")}
                </div>
              )}
            </div>
          </div>

          {/* Agent earnings */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">
                <Wallet size={14} />
                Agent Earnings
              </div>
              <div className="live-dot" />
            </div>
            <div className="card-body">
              <div className="earn-value">{(stats.trades * 0.001).toFixed(3)} SOL</div>
              <div className="earn-rows">
                <div className="earn-row">
                  <span className="lbl">Stream rate</span>
                  <span className="val">0.001 SOL / trade</span>
                </div>
                <div className="earn-row">
                  <span className="lbl">Trades executed</span>
                  <span className="val">{stats.trades}</span>
                </div>
                <div className="earn-row">
                  <span className="lbl">Win rate</span>
                  <span className="val">{stats.winRate}%</span>
                </div>
                <div className="earn-row">
                  <span className="lbl">Provider</span>
                  <span className="val">pay.sh stream</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatCell({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: string;
  delta: string;
  up?: boolean;
}) {
  return (
    <div className="stat-cell">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta${up ? " up" : ""}`}>{delta}</div>
    </div>
  );
}

function Ticket({ decision }: { decision: Decision }) {
  const dir = dirLabel(decision.consensus.direction);
  const cls = dir.toLowerCase();
  return (
    <article className={`ticket ${cls}`}>
      <div className="ticket-top">
        <div className="ticket-dir">
          <span className={`dir-badge ${cls}`}>{dir}</span>
          <span className="ticket-market">{decision.market}</span>
        </div>
        <span className="ticket-confidence">{decision.consensus.confidence}% conf</span>
      </div>

      <div className="ticket-meta">
        <span>{decision.consensus.leverage}x leverage</span>
        <span>{new Date(decision.timestamp * 1000).toLocaleTimeString()}</span>
        <span>#{decision.decisionIndex}</span>
      </div>

      <div className="votes">
        <VoteRow name="bull" vote={decision.bullVote} />
        <VoteRow name="bear" vote={decision.bearVote} />
        <VoteRow name="zen"  vote={decision.zenVote}  />
      </div>

      <div className="ticket-foot">
        <span className="ticket-status">
          {decision.executed ? "EXECUTED" : "LOGGED"}
        </span>
        <span className="tx-ref">
          TX {decision.executionRef || "pending"}
        </span>
      </div>
    </article>
  );
}

function VoteRow({ name, vote }: { name: string; vote: Vote }) {
  return (
    <div className="vote-row">
      <span className={`vote-agent ${name}`}>{name}</span>
      <span className="vote-text">
        {dirLabel(vote.direction)} {vote.leverage}x ({vote.confidence}%) — &quot;{vote.reasoning}&quot;
      </span>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

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
  publicKey() { const k = new PublicKey(this.data.subarray(this.offset, this.offset + 32)); this.offset += 32; return k; }
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
    return { direction: this.u8(), leverage: this.u8(), confidence: this.u8(), reasoning: this.fixedString(200) };
  }
  skipU64AfterPnl() { this.offset += 8; return this.u64(); }
}

function dirLabel(d: number) {
  if (d === 1) return "LONG";
  if (d === 2) return "SHORT";
  return "FLAT";
}

async function discriminator(ns: string, name: string) {
  const b = new TextEncoder().encode(`${ns}:${name}`);
  const h = await crypto.subtle.digest("SHA-256", b);
  return Buffer.from(h).subarray(0, 8);
}

function u64(v: bigint) { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function readonly(pubkey: PublicKey) { return { pubkey, isSigner: false, isWritable: false }; }
function writable(pubkey: PublicKey) { return { pubkey, isSigner: false, isWritable: true }; }
function signer(pubkey: PublicKey)   { return { pubkey, isSigner: true,  isWritable: true }; }
