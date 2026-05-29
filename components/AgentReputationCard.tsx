import { useEffect, useState } from "react";
import { Connection } from "@solana/web3.js";
import { Buffer } from "buffer";
import { ExternalLink, Trophy } from "lucide-react";
import {
  AgentReputationData,
  RPC_URL,
  VAULT_ADDRESS,
  decodeAgentReputation,
  deriveAgentReputationPda,
} from "../lib/chain";

/**
 * AgentReputationCard
 * --------------------
 * Reads the per-agent reputation PDA (["agent_reputation", VAULT]) and
 * renders win-rate per persona. The PDA may not exist yet on a freshly
 * upgraded program - in that case we render a neutral empty state with
 * "-" per persona, so the dashboard never looks broken.
 *
 * No backend route required. The single-account read goes through the
 * Helius-cached `/api/rpc` proxy via the shared `RPC_URL` resolver.
 */

type Persona = "BULL" | "BEAR" | "ZEN";

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
  const [rep, setRep] = useState<AgentReputationData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pda = deriveAgentReputationPda(VAULT_ADDRESS);

  useEffect(() => {
    let cancelled = false;
    const connection = new Connection(RPC_URL, "confirmed");

    async function read() {
      try {
        const info = await connection.getAccountInfo(pda);
        if (cancelled) return;
        if (!info) {
          setRep(null);
          setLoaded(true);
          return;
        }
        setRep(decodeAgentReputation(pda, Buffer.from(info.data)));
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
  }, [pda]);

  const rows: Row[] = rep
    ? [
        { persona: "BULL", correct: rep.bullCorrect, total: rep.bullTotal, accent: "rep-bull" },
        { persona: "BEAR", correct: rep.bearCorrect, total: rep.bearTotal, accent: "rep-bear" },
        { persona: "ZEN", correct: rep.zenCorrect, total: rep.zenTotal, accent: "rep-zen" },
      ]
    : [
        { persona: "BULL", correct: 0, total: 0, accent: "rep-bull" },
        { persona: "BEAR", correct: 0, total: 0, accent: "rep-bear" },
        { persona: "ZEN", correct: 0, total: 0, accent: "rep-zen" },
      ];

  const explorer = `https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`;

  return (
    <section className="rep-card" aria-label="Per-agent reputation">
      <header className="rep-card__header">
        <div className="rep-card__title">
          <Trophy size={14} />
          <strong>Agent reputation</strong>
          <span className="rep-card__chip">PDA</span>
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
        Closed-trade win rate. FLAT votes are excluded.
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
        {loaded && !rep ? (
          <span className="rep-card__empty">
            Activates after the next devnet upgrade.
          </span>
        ) : rep ? (
          <span className="rep-card__updated">
            Updated {formatTimestamp(rep.lastUpdated)}
          </span>
        ) : (
          <span className="rep-card__updated">Loading…</span>
        )}
      </footer>
    </section>
  );
}
