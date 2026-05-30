import { useEffect, useState } from "react";
import { ExternalLink, Trophy } from "lucide-react";
import { VAULT_ADDRESS, deriveAgentReputationPda } from "../lib/chain";

/**
 * AgentReputationCard
 * --------------------
 * Renders per-persona (BULL / BEAR / ZEN) closed-trade win rate.
 *
 * The numbers are computed by `/api/reputation` from data that already
 * lives on-chain: each persona's vote direction (from the
 * `MultiAgentDecision` PDA) joined to the realized PnL of the position it
 * opened (from the `SyntheticPosition` PDA), scored with the same rule the
 * on-chain `update_agent_reputation` would use.
 *
 * We compute rather than read the dedicated `AgentReputation` PDA because
 * the deployed devnet program is immutable and predates that instruction —
 * the PDA can never be created against it. Computing from existing accounts
 * makes the metric real today without a redeploy.
 */

type Persona = "BULL" | "BEAR" | "ZEN";

type Counter = { correct: number; total: number };

type ReputationResponse = {
  bull: Counter;
  bear: Counter;
  zen: Counter;
  closedTrades: number;
  matchedTrades: number;
  lastUpdated: number;
};

type Row = {
  persona: Persona;
  correct: number;
  total: number;
  accent: string;
};

const POLL_INTERVAL_MS = 60_000;

function formatRate(correct: number, total: number): string {
  if (total === 0) return "-";
  const pct = (correct / total) * 100;
  return `${pct.toFixed(0)}%`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AgentReputationCard() {
  const [rep, setRep] = useState<ReputationResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pda = deriveAgentReputationPda(VAULT_ADDRESS);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      try {
        const res = await fetch("/api/reputation", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = (await res.json()) as ReputationResponse;
        if (cancelled) return;
        setRep(data);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    void read();
    const id = window.setInterval(() => void read(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const rows: Row[] = [
    {
      persona: "BULL",
      correct: rep?.bull.correct ?? 0,
      total: rep?.bull.total ?? 0,
      accent: "rep-bull",
    },
    {
      persona: "BEAR",
      correct: rep?.bear.correct ?? 0,
      total: rep?.bear.total ?? 0,
      accent: "rep-bear",
    },
    {
      persona: "ZEN",
      correct: rep?.zen.correct ?? 0,
      total: rep?.zen.total ?? 0,
      accent: "rep-zen",
    },
  ];

  const hasData = rows.some((r) => r.total > 0);
  const explorer = `https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`;

  return (
    <section className="rep-card" aria-label="Per-agent reputation">
      <header className="rep-card__header">
        <div className="rep-card__title">
          <Trophy size={14} />
          <strong>Agent reputation</strong>
          <span className="rep-card__chip">LIVE</span>
        </div>
        <a
          className="rep-card__link"
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{`${pda.toBase58().slice(0, 4)}…${pda.toBase58().slice(-4)}`}</span>
          <ExternalLink size={11} />
        </a>
      </header>

      <p className="rep-card__sub">
        Closed-trade win rate, computed on-chain. FLAT votes are excluded.
      </p>

      <div className="rep-card__grid">
        {rows.map((row) => {
          const rate = formatRate(row.correct, row.total);
          const widthPct = row.total > 0 ? (row.correct / row.total) * 100 : 0;
          return (
            <div className={`rep-row ${row.accent}`} key={row.persona}>
              <span className="rep-row__persona">{row.persona}</span>
              <span className="rep-row__rate">{rate}</span>
              <span className="rep-row__count">
                {row.total > 0 ? `${row.correct}/${row.total} wins` : "No trades"}
              </span>
              <span className="rep-row__bar">
                <span style={{ width: `${widthPct}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      <footer className="rep-card__footer">
        {!loaded ? (
          <span className="rep-card__updated">Loading…</span>
        ) : hasData ? (
          <span className="rep-card__updated">
            {`${rep?.matchedTrades ?? 0} closed trades scored · updated ${formatTimestamp(
              rep?.lastUpdated ?? 0
            )}`}
          </span>
        ) : (
          <span className="rep-card__empty">
            Activates once the agent closes its first directional trade.
          </span>
        )}
      </footer>
    </section>
  );
}
