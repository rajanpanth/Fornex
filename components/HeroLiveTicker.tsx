import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
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

export default function HeroLiveTicker() {
  const [latest, setLatest] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatest() {
      try {
        const connection = new Connection(RPC, "confirmed");
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

  return (
    <div className="hero-live-ticker" role="status" aria-live="polite">
      <span className="ticker-dot" aria-hidden="true">●</span>
      <span className="ticker-label">Latest on-chain:</span>
      <span className={`ticker-direction ${cls}`}>
        {direction} {latest.consensus.leverage}×
      </span>
      <span className="ticker-conf">{latest.consensus.confidence}% conf</span>
      <span className="ticker-time">{formatTimeAgo(latest.timestamp)}</span>
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
