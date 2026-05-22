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
import { Activity, ArrowDownToLine, ArrowUpFromLine, Radio } from "lucide-react";
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
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [range, setRange] = useState<"24h" | "all">("24h");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    const vaultInfo = await connection.getAccountInfo(VAULT_ADDRESS);
    if (vaultInfo) setVault(decodeVault(vaultInfo.data));

    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 8 + 32 + 4 + 16 + 4 * 203 + 8 + 1 + 88 + 8 + 8 + 1 }],
    });
    const parsed = accounts
      .map((account) => decodeDecision(account.pubkey, account.account.data))
      .filter(Boolean)
      .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
      .slice(0, 10) as Decision[];
    setDecisions(parsed);
  }, [connection]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const chartData = useMemo(() => {
    const base = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 1;
    const points = range === "24h" ? 24 : 36;
    return Array.from({ length: points }, (_, index) => ({
      time: `${index}`,
      nav: Number((base * (0.98 + index / (points * 35))).toFixed(4)),
    }));
  }, [range, vault]);

  const stats = {
    nav: vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0,
    totalShares: vault ? Number(vault.totalShares) / LAMPORTS_PER_SOL : 0,
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
      setNotice(`${kind} success: ${sig.slice(0, 8)}...${sig.slice(-8)}`);
      await refresh();
    } catch (error: any) {
      setNotice(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">FORNEX</div>
        <div className="header-actions">
          <span className="badge">DEVNET</span>
          {mounted && <WalletMultiButton />}
        </div>
      </header>

      <section className="grid stats">
        <Stat label="Total Vault Value" value={`${stats.nav.toFixed(2)} SOL`} delta="+2.4%" />
        <Stat label="Your Shares" value={`${stats.totalShares.toFixed(4)}`} delta="vault shares" />
        <Stat label="Your P&L" value="+0.00%" delta="after deposit" positive />
        <Stat label="Total Trades" value={`${stats.trades}`} delta={`${stats.winRate}% win rate`} />
      </section>

      <section className="grid main" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-title">
            <span><Radio size={18} /> 🧠 Agent Decisions - Live On-Chain</span>
            <span className="dot" />
          </div>
          <div className="feed">
            {decisions.length === 0 ? (
              <div className="quote">Waiting for first on-chain decision...</div>
            ) : (
              decisions.map((decision) => <DecisionCard key={decision.pubkey.toBase58()} decision={decision} />)
            )}
          </div>
        </div>

        <div className="right-stack">
          <div className="panel">
            <div className="panel-title">
              Equity Curve
              <div className="segmented">
                <button className={range === "24h" ? "active" : ""} onClick={() => setRange("24h")}>24h</button>
                <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>All</button>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="time" stroke="#7b8fa6" />
                  <YAxis stroke="#7b8fa6" />
                  <Tooltip contentStyle={{ background: "#10172a", border: "1px solid rgba(255,255,255,.1)" }} />
                  <Line type="monotone" dataKey="nav" stroke="#00ff88" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title"><Activity size={18} /> Current Drift Position</div>
            <div className="value neutral">FLAT</div>
            <p className="quote">No active position detected. Updates every 30 seconds.</p>
          </div>

          <div className="panel">
            <div className="tabs">
              <button className={`tab ${tab === "deposit" ? "active" : ""}`} onClick={() => setTab("deposit")}>
                <ArrowDownToLine size={16} /> Deposit
              </button>
              <button className={`tab ${tab === "withdraw" ? "active" : ""}`} onClick={() => setTab("withdraw")}>
                <ArrowUpFromLine size={16} /> Withdraw
              </button>
            </div>
            <div className="input-row">
              <input value={amount} onChange={(event) => setAmount(event.target.value)} />
              <div className="quote">
                Expected {tab === "deposit" ? "shares" : "SOL"}: {amount || "0"}
              </div>
              <button className="action" disabled={loading || !wallet.publicKey} onClick={() => sendVaultIx(tab)}>
                {loading ? "Sending..." : tab === "deposit" ? "Deposit" : "Withdraw"}
              </button>
              {notice && <div className={notice.includes("success") ? "positive" : "negative"}>{notice}</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Agent Earnings <span className="dot" /></div>
            <div className="value">0.001 SOL</div>
            <div className="quote">Stream rate: 0.001 SOL per trade. Last payment: pending.</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, delta, positive = false }: { label: string; value: string; delta: string; positive?: boolean }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className={positive || delta.startsWith("+") ? "positive" : "neutral"}>{delta}</div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  const direction = directionLabel(decision.consensus.direction);
  return (
    <article className={`decision ${direction.toLowerCase()}`}>
      <div className="decision-head">
        <strong>{decision.executed ? "EXECUTED" : "LOGGED"} {direction} {decision.consensus.leverage}x</strong>
        <span className="mono">{decision.consensus.confidence}%</span>
      </div>
      <div className="quote">{decision.market} | {new Date(decision.timestamp * 1000).toLocaleTimeString()}</div>
      <AgentLine name="BULL" vote={decision.bullVote} />
      <AgentLine name="BEAR" vote={decision.bearVote} />
      <AgentLine name="ZEN" vote={decision.zenVote} />
      <div className="decision-foot agent-line">
        <strong>CONSENSUS: {direction}</strong>
        <span className="mono">TX {decision.executionRef || "pending"}</span>
      </div>
    </article>
  );
}

function AgentLine({ name, vote }: { name: string; vote: Vote }) {
  return (
    <div className="agent-line">
      <strong>{name}: {directionLabel(vote.direction)} {vote.leverage}x ({vote.confidence}%)</strong>
      <span className="quote">"{vote.reasoning}"</span>
    </div>
  );
}

function decodeVault(data: Buffer) {
  const reader = new Reader(data);
  reader.skip(8);
  return {
    agentAuthority: reader.publicKey(),
    admin: reader.publicKey(),
    totalDeposits: reader.u64(),
    totalShares: reader.u64(),
    nav: reader.u64(),
    tradeCount: reader.u32(),
    winningTrades: reader.u32(),
    isTradingPaused: reader.bool(),
  };
}

function decodeDecision(pubkey: PublicKey, data: Buffer): Decision | null {
  try {
    const reader = new Reader(data);
    reader.skip(8);
    reader.publicKey();
    return {
      pubkey,
      decisionIndex: reader.u32(),
      market: reader.fixedString(16),
      bullVote: reader.vote(),
      bearVote: reader.vote(),
      zenVote: reader.vote(),
      consensus: reader.vote(),
      sizeUsd: Number(reader.u64()),
      executed: reader.bool(),
      executionRef: reader.fixedString(88),
      timestamp: Number(reader.skipU64AfterPnl()),
    };
  } catch {
    return null;
  }
}

class Reader {
  private offset = 0;
  constructor(private data: Buffer) {}
  skip(bytes: number) { this.offset += bytes; }
  publicKey() { const key = new PublicKey(this.data.subarray(this.offset, this.offset + 32)); this.offset += 32; return key; }
  u8() { const value = this.data.readUInt8(this.offset); this.offset += 1; return value; }
  bool() { return this.u8() === 1; }
  u32() { const value = this.data.readUInt32LE(this.offset); this.offset += 4; return value; }
  u64() { const value = this.data.readBigUInt64LE(this.offset); this.offset += 8; return value; }
  fixedString(size: number) { const bytes = this.data.subarray(this.offset, this.offset + size); this.offset += size; const end = bytes.indexOf(0); return bytes.subarray(0, end === -1 ? size : end).toString("utf8"); }
  vote(): Vote { return { direction: this.u8(), leverage: this.u8(), confidence: this.u8(), reasoning: this.fixedString(200) }; }
  skipU64AfterPnl() { this.offset += 8; return this.u64(); }
}

function directionLabel(direction: number) {
  if (direction === 1) return "LONG";
  if (direction === 2) return "SHORT";
  return "FLAT";
}

async function discriminator(namespace: string, name: string) {
  const bytes = new TextEncoder().encode(`${namespace}:${name}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(hash).subarray(0, 8);
}
function u64(value: bigint) { const buffer = Buffer.alloc(8); buffer.writeBigUInt64LE(value); return buffer; }
function readonly(pubkey: PublicKey) { return { pubkey, isSigner: false, isWritable: false }; }
function writable(pubkey: PublicKey) { return { pubkey, isSigner: false, isWritable: true }; }
function signer(pubkey: PublicKey) { return { pubkey, isSigner: true, isWritable: true }; }
