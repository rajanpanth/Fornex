import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useEffect, useState } from "react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  decodeDecision,
  dirLabel,
  formatTimeAgo,
} from "../lib/chain";

const PROGRAM_ID = "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";
const RPC = "https://api.devnet.solana.com";

export default function LiveDecisionPreview() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [count, setCount] = useState(0);
  const [nextIn, setNextIn] = useState(900);

  useEffect(() => {
    async function fetchLive() {
      try {
        const connection = new Connection(RPC, "confirmed");
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNextIn((prev) => (prev <= 1 ? 900 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatNext = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <section className="live-section">
      <div className="live-header">
        <div className="section-label">⚡ LIVE ON-CHAIN NOW</div>
        <h2>Watch the agents work. Right now.</h2>
        <p>
          No wallet needed. These are real AI decisions stored permanently on
          Solana devnet.
        </p>
        <div className="live-stats">
          <span className="live-count">{count} decisions on Solana</span>
          <span className="live-divider">·</span>
          <span className="live-next">Next in {formatNext(nextIn)}</span>
          <span className="live-dot">●</span>
        </div>
      </div>

      <div className="live-cards">
        {decisions.map((decision) => (
          <MiniDecisionCard
            key={decision.pubkey.toBase58()}
            decision={decision}
          />
        ))}
      </div>

      <a href="/app" className="live-cta">
        View all {count} decisions in the app →
      </a>
    </section>
  );
}

function MiniDecisionCard({ decision }: { decision: Decision }) {
  const direction = dirLabel(decision.consensus.direction);

  return (
    <article className={`mini-decision-card ${direction.toLowerCase()}`}>
      <div className="mini-decision-top">
        <span className="mini-direction">{direction}</span>
        <span>{formatTimeAgo(decision.timestamp)}</span>
      </div>
      <div className="mini-agent-votes">
        <span>🐂 {dirLabel(decision.bullVote.direction)}</span>
        <span>🐻 {dirLabel(decision.bearVote.direction)}</span>
        <span>⚖️ {dirLabel(decision.zenVote.direction)}</span>
      </div>
      <p>{decision.consensus.confidence}% confidence</p>
      <a
        href={`https://explorer.solana.com/account/${decision.pubkey.toBase58()}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Explorer ↗
      </a>
    </article>
  );
}
