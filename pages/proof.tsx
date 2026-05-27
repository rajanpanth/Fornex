import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import Head from "next/head";
import Link from "next/link";
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

export default function ProofPage() {
  const [entries, setEntries] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
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
        const decoded = accounts
          .map(({ pubkey, account }) =>
            decodeDecision(pubkey, Buffer.from(account.data))
          )
          .filter((d): d is Decision => Boolean(d))
          .sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) {
          setEntries(decoded);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch from Solana devnet");
          setLoading(false);
        }
      }
    }

    void fetchAll();
    const id = setInterval(() => void fetchAll(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Fornex — On-Chain Proof</title>
        <meta
          name="description"
          content="Every Fornex AI decision permanently stored on Solana devnet. Verifiable wall of evidence."
        />
      </Head>
      <div className="proof-page">
        <div className="proof-header">
          <h1>On-Chain Proof</h1>
          <p>
            Every AI decision permanently stored on Solana. Click any entry to
            verify on Explorer.
          </p>
          <div className="proof-stats">
            <span>{entries.length} decisions</span>
            <span>·</span>
            <span>Solana Devnet</span>
            <span>·</span>
            <span>Agent running since May 22, 2026</span>
          </div>
          <div className="proof-stats" style={{ marginTop: 8 }}>
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Program ↗
            </a>
            <span>·</span>
            <a
              href="https://explorer.solana.com/address/HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vault PDA ↗
            </a>
            <span>·</span>
            <a
              href="https://explorer.solana.com/address/BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              $FNRX Mint ↗
            </a>
          </div>
        </div>

        {loading ? (
          <div className="proof-loading">Fetching from Solana devnet…</div>
        ) : error ? (
          <div className="proof-loading">
            Couldn&apos;t reach devnet: {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="proof-loading">
            No decisions found. Agent makes a new decision every 15 minutes.
          </div>
        ) : (
          <div className="proof-grid">
            {entries.map((entry) => {
              const dir = dirLabel(entry.consensus.direction);
              return (
                <a
                  key={entry.pubkey.toBase58()}
                  href={`https://explorer.solana.com/address/${entry.pubkey.toBase58()}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="proof-entry"
                >
                  <span className="proof-index">#{entry.decisionIndex}</span>
                  <span className="proof-pubkey">
                    {entry.pubkey.toBase58().slice(0, 8)}…
                    {entry.pubkey.toBase58().slice(-8)}
                  </span>
                  <span className="proof-time">
                    {dir} · {formatTimeAgo(entry.timestamp)}
                  </span>
                  <span className="proof-arrow">↗</span>
                </a>
              );
            })}
          </div>
        )}

        <div className="proof-footer">
          <Link href="/">← Back to Fornex</Link>
          <Link href="/app">Open App →</Link>
        </div>
      </div>
    </>
  );
}
