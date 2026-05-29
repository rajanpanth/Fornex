import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
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

/**
 * Brain cycle interval — must match LOOP_MS in `agent/src/index.ts`.
 * Used to derive the "next cycle in mm:ss" countdown shown next to the
 * latest on-chain decision. If the agent is overdue (countdown would be
 * negative), we display "due now" rather than a confusing zero.
 */
const CYCLE_MS = 15 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "due now";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HeroLiveTicker() {
  const [latest, setLatest] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatest() {
      try {
        const connection = new Connection(RPC_URL, "confirmed");
        const programId = new PublicKey(PROGRAM_ID);
        const [current, legacy] = await Promise.all([
          connection.getProgramAccounts(programId, {
            filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
          }),
          connection.getProgramAccounts(programId, {
            filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
          }),
        ]);
        const accounts = [...current, ...legacy];
        if (accounts.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }
        const decoded = accounts
          .map(({ pubkey, account }) =>
            decodeDecision(pubkey, Buffer.from(account.data))
          )
          .filter((d): d is Decision => Boolean(d))
          .sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) {
          setLatest(decoded[0] ?? null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchLatest();
    const id = setInterval(() => void fetchLatest(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading || !latest) return null;

  const direction = dirLabel(latest.consensus.direction);
  const cls =
    direction === "LONG" ? "long" : direction === "SHORT" ? "short" : "flat";

  // Time of last decision in ms. We fall back to "now" if the field is
  // unexpectedly zero so the countdown never shows a 27-year-overdue value.
  const lastMs = latest.timestamp > 0 ? latest.timestamp * 1000 : now;
  const nextMs = lastMs + CYCLE_MS;
  const countdown = formatCountdown(nextMs - now);
  const isOverdue = nextMs - now <= 0;

  return (
    <div className="hero-live-ticker" role="status" aria-live="polite">
      <span className="ticker-dot" aria-hidden="true">●</span>
      <span className="ticker-label">Latest on-chain:</span>
      <span className={`ticker-direction ${cls}`}>
        {direction} {latest.consensus.leverage}×
      </span>
      <span className="ticker-conf">{latest.consensus.confidence}% conf</span>
      <span className="ticker-time">{formatTimeAgo(latest.timestamp)}</span>
      <span
        className={`ticker-countdown ${isOverdue ? "is-due" : ""}`}
        title="Next agent cycle (15-minute brain interval)"
      >
        next in {countdown}
      </span>
      <a
        href={`https://explorer.solana.com/address/${latest.pubkey.toBase58()}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="ticker-link"
      >
        verify ↗
      </a>
    </div>
  );
}
