import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  RPC_URL,
  decodeDecision,
  dirLabel,
  formatTimeAgo,
} from "../lib/chain";

const PROGRAM_ID = "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";

export default function LiveDecisionPreview() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [count, setCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Brain interval - must match LOOP_MS in agent/src/index.ts.
  const CYCLE_MS = 15 * 60 * 1000;

  useEffect(() => {
    async function fetchLive() {
      try {
        const connection = new Connection(RPC_URL, "confirmed");
        const programId = new PublicKey(PROGRAM_ID);
        const [currentAccounts, legacyAccounts] = await Promise.all([
          connection.getProgramAccounts(programId, {
            filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
          }),
          connection.getProgramAccounts(programId, {
            filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
          }),
        ]);
        const accounts = [...currentAccounts, ...legacyAccounts];
        setCount(accounts.length);

        const decoded = accounts
          .map(({ pubkey, account }) =>
            decodeDecision(pubkey, Buffer.from(account.data))
          )
          .filter((decision): decision is Decision => Boolean(decision))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 3);
        setDecisions(decoded);
      } catch (err) {
        console.warn("Live feed error:", err);
      }
    }

    void fetchLive();
    const interval = window.setInterval(fetchLive, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Tick every second so the countdown updates smoothly. Real time source
  // is the on-chain timestamp of the most recent decision (decisions[0]).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatNext = (ms: number) => {
    if (ms <= 0) return "due now";
    const totalSec = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Anchor the "Next in" pill to the most recent on-chain decision so this
  // landing-page widget agrees with the dashboard and the hero ticker.
  // Falls back to a 15-minute clock from page mount if no decisions yet.
  const lastTsMs =
    decisions.length > 0 && decisions[0].timestamp > 0
      ? decisions[0].timestamp * 1000
      : null;
  const nextInMs = lastTsMs ? lastTsMs + CYCLE_MS - now : CYCLE_MS;

  return (
    <section className="live-section">
      <div className="live-header">
        <div className="section-label">LIVE ON-CHAIN NOW</div>
        <h2>Watch the agents work. Right now.</h2>
        <p>
          No wallet needed. These are real AI decisions stored permanently on
          Solana devnet.
        </p>
        <div className="live-stats">
          <span className="live-stats__status">
            <span className="live-dot">●</span>
            Streaming devnet
          </span>
          <span className="live-count">{count} decisions on Solana</span>
          <span className="live-next">Next in {formatNext(nextInMs)}</span>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="live-empty-state">
          <div className="live-scanning">
            <span className="scan-dot">●</span>
            <span className="scan-dot">●</span>
            <span className="scan-dot">●</span>
          </div>
          <p className="live-empty-text">
            Scanning Solana devnet for decisions…
          </p>
          <p className="live-empty-sub">
            Agent makes a new decision every 15 minutes. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="live-cards">
          {decisions.map((decision, i) => (
            <MiniDecisionCard
              key={decision.pubkey.toBase58()}
              decision={decision}
              isLatest={i === 0}
            />
          ))}
        </div>
      )}

      <div className="live-section-actions">
        <Link href="/app" className="live-cta">
          View all {count} decisions in the app →
        </Link>
        <Link href="/proof" className="live-cta live-cta--alt">
          Inspect on-chain proof →
        </Link>
      </div>
    </section>
  );
}

function MiniDecisionCard({
  decision,
  isLatest = false,
}: {
  decision: Decision;
  isLatest?: boolean;
}) {
  const direction = dirLabel(decision.consensus.direction);
  const confidence = decision.consensus.confidence;
  const account = decision.pubkey.toBase58();
  const shortAccount = `${account.slice(0, 4)}…${account.slice(-4)}`;

  const bull = dirLabel(decision.bullVote.direction);
  const bear = dirLabel(decision.bearVote.direction);
  const zen = dirLabel(decision.zenVote.direction);

  // Count agents that agree with the final consensus direction so the
  // card can surface the vote split (e.g. "2/3 agree") at a glance.
  const votes = [bull, bear, zen];
  const agreeing = votes.filter((v) => v === direction).length;

  return (
    <article
      className={`mini-decision-card ${direction.toLowerCase()}${
        isLatest ? " is-latest" : ""
      }`}
    >
      <div className="mini-decision-top">
        <div>
          <span className="mini-direction">{direction}</span>
          <span className="mini-market">SOL-PERP consensus</span>
        </div>
        <span className="mini-time">{formatTimeAgo(decision.timestamp)}</span>
      </div>
      <div className="mini-agent-votes">
        <span className={`vote-${bull.toLowerCase()}`}>
          <b>BULL</b>
          {bull}
        </span>
        <span className={`vote-${bear.toLowerCase()}`}>
          <b>BEAR</b>
          {bear}
        </span>
        <span className={`vote-${zen.toLowerCase()}`}>
          <b>ZEN</b>
          {zen}
        </span>
      </div>
      <div className="mini-confidence">
        <div className="mini-confidence__row">
          <span>Confidence</span>
          <strong>
            <span className="mini-vote-split">{agreeing}/3 agree</span>
            {confidence}%
          </strong>
        </div>
        <div className="mini-confidence__track" aria-hidden="true">
          <span style={{ width: `${confidence}%` }} />
        </div>
      </div>
      <div className="mini-account">
        <span>Decision account</span>
        <code>{shortAccount}</code>
      </div>
      <a
        href={`https://explorer.solana.com/account/${account}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Inspect account
      </a>
    </article>
  );
}
