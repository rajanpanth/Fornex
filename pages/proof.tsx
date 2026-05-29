import { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import Head from "next/head";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Hash,
  Network,
  Radio,
  ShieldCheck,
} from "lucide-react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  RPC_URL,
  decodeDecision,
  dirLabel,
  formatTimeAgo,
} from "../lib/chain";
import { useDecisionStream } from "../hooks/useDecisionStream";

const PROGRAM_ID = "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";
const VAULT_PDA = "HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR";
const FNRX_MINT = "BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj";

type Filter = "all" | "long" | "short" | "flat";
const PAGE_SIZE = 10;

export default function ProofPage() {
  const [entries, setEntries] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [livePulse, setLivePulse] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
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
        const decoded = accounts
          .map(({ pubkey, account }) =>
            decodeDecision(pubkey, Buffer.from(account.data))
          )
          .filter((d): d is Decision => Boolean(d))
          .sort((a, b) => b.timestamp - a.timestamp);
        if (!cancelled) {
          setEntries(decoded);
          setLoading(false);
          setError(null);
          setLastSync(Date.now());
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch from Solana devnet");
          setLoading(false);
        }
      }
    }

    void fetchAll();
    // Polling backstop. The live WSS stream below pushes refreshes
    // immediately when the program emits matching logs; this 60s tick
    // keeps the page accurate when the socket is unavailable.
    const id = setInterval(() => void fetchAll(), 60_000);
    // Expose the fetch fn to the live-stream effect via a ref-like trick:
    // we simply re-trigger via livePulse -> useEffect dep.
    (window as any).__fornexProofRefresh = fetchAll;
    return () => {
      cancelled = true;
      clearInterval(id);
      delete (window as any).__fornexProofRefresh;
    };
  }, []);

  // Re-run the fetch on every live-pulse tick (one tick per matched log).
  useEffect(() => {
    if (livePulse === 0) return;
    const fn = (window as any).__fornexProofRefresh as
      | (() => Promise<void>)
      | undefined;
    if (fn) void fn();
  }, [livePulse]);

  // Live push: any matching program log bumps the pulse counter, which
  // re-runs the fetcher above. No-op when no WSS endpoint is reachable.
  useDecisionStream(() => {
    setLivePulse((p) => p + 1);
  });

  const stats = useMemo(() => {
    const longs = entries.filter((e) => e.consensus.direction === 1).length;
    const shorts = entries.filter((e) => e.consensus.direction === 2).length;
    const flats = entries.filter((e) => e.consensus.direction === 0).length;
    const executed = entries.filter((e) => e.executed).length;
    return { longs, shorts, flats, executed };
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (filter === "all") return entries;
    const dirNum = filter === "long" ? 1 : filter === "short" ? 2 : 0;
    return entries.filter((e) => e.consensus.direction === dirNum);
  }, [entries, filter]);

  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleEntries.slice(start, start + PAGE_SIZE);
  }, [currentPage, visibleEntries]);

  const lastSyncLabel = lastSync
    ? `${Math.max(1, Math.floor((Date.now() - lastSync) / 1000))}s ago`
    : "-";

  return (
    <>
      <Head>
        <title>Fornex - On-Chain Proof</title>
        <meta
          name="description"
          content="Every Fornex AI decision permanently stored on Solana devnet. Verifiable wall of evidence."
        />
      </Head>
      <div className="proof-page">
        <div className="proof-bg" aria-hidden="true">
          <div className="proof-bg__beam" />
          <div className="proof-bg__grid" />
        </div>

        <header className="proof-topbar">
          <Link href="/" className="proof-topbar__logo">
            FORNEX
          </Link>
          <nav className="proof-topbar__nav" aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/app">App</Link>
            <Link href="/proof" aria-current="page">
              Proof
            </Link>
          </nav>
          <Link href="/app" className="proof-topbar__cta">
            Launch App <ArrowRight size={15} />
          </Link>
        </header>

        <section className="proof-hero">
          <div className="proof-hero__kicker">
            <ShieldCheck size={13} />
            ON-CHAIN PROOF · SOLANA DEVNET
          </div>
          <h1 className="proof-hero__title">
            Every AI decision. Permanent. Verifiable.
          </h1>
          <p className="proof-hero__sub">
            Each entry below is a Solana account written by the Fornex agent.
            Click any row to inspect votes, reasoning, and the consensus on
            Solana Explorer.
          </p>

          <div className="proof-hero__refs">
            <a
              className="proof-ref"
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Hash size={13} />
              <span className="proof-ref__label">Program</span>
              <span className="proof-ref__value">
                {PROGRAM_ID.slice(0, 4)}…{PROGRAM_ID.slice(-4)}
              </span>
              <ExternalLink size={11} />
            </a>
            <a
              className="proof-ref"
              href={`https://explorer.solana.com/address/${VAULT_PDA}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Database size={13} />
              <span className="proof-ref__label">Vault PDA</span>
              <span className="proof-ref__value">
                {VAULT_PDA.slice(0, 4)}…{VAULT_PDA.slice(-4)}
              </span>
              <ExternalLink size={11} />
            </a>
            <a
              className="proof-ref"
              href={`https://explorer.solana.com/address/${FNRX_MINT}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Network size={13} />
              <span className="proof-ref__label">$FNRX Mint</span>
              <span className="proof-ref__value">
                {FNRX_MINT.slice(0, 4)}…{FNRX_MINT.slice(-4)}
              </span>
              <ExternalLink size={11} />
            </a>
          </div>

          <div className="proof-hero__stats">
            <div>
              <strong>{loading ? "-" : entries.length}</strong>
              <span>Decisions</span>
            </div>
            <div>
              <strong className="up">{loading ? "-" : stats.longs}</strong>
              <span>Long</span>
            </div>
            <div>
              <strong className="down">{loading ? "-" : stats.shorts}</strong>
              <span>Short</span>
            </div>
            <div>
              <strong className="muted">{loading ? "-" : stats.flats}</strong>
              <span>Flat</span>
            </div>
            <div>
              <strong>{loading ? "-" : stats.executed}</strong>
              <span>Executed</span>
            </div>
            <div className="proof-hero__sync">
              <Radio size={11} />
              <span>Synced {lastSyncLabel}</span>
              {livePulse > 0 && (
                <span className="proof-hero__live" title="Live stream pushed an update">
                  <span className="live-dot" /> live
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="proof-toolbar">
          <div className="proof-filters" role="tablist" aria-label="Filter decisions">
            {(["all", "long", "short", "flat"] as Filter[]).map((f) => {
              const count =
                f === "all"
                  ? entries.length
                  : f === "long"
                  ? stats.longs
                  : f === "short"
                  ? stats.shorts
                  : stats.flats;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  className={`proof-filter ${filter === f ? "is-active" : ""} f-${f}`}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                >
                  <span>{f === "all" ? "All" : f.toUpperCase()}</span>
                  <small>{count}</small>
                </button>
              );
            })}
          </div>
        </div>

        <main className="proof-main">
          {loading ? (
            <div className="proof-skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="proof-skeleton__row" />
              ))}
            </div>
          ) : error ? (
            <div className="proof-empty">
              <strong>Couldn&apos;t reach devnet</strong>
              <p>{error}</p>
              <p className="proof-empty__hint">
                Public devnet RPC rate-limits aggressively. The page will
                retry every 60 seconds, or you can open Solana Explorer
                directly via the program link above.
              </p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="proof-empty">
              <strong>
                {entries.length === 0
                  ? "No decisions yet"
                  : "No decisions match this filter"}
              </strong>
              <p>
                {entries.length === 0
                  ? "Agent makes a new decision every 15 minutes. Check back shortly."
                  : "Try a different direction filter."}
              </p>
            </div>
          ) : (
            <>
              <div className="proof-list">
                {pagedEntries.map((entry) => {
                  const dir = dirLabel(entry.consensus.direction);
                  const cls = dir.toLowerCase();
                  return (
                    <a
                      key={entry.pubkey.toBase58()}
                      href={`https://explorer.solana.com/address/${entry.pubkey.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`proof-entry proof-entry--${cls}`}
                    >
                      <span className="proof-entry__index">
                        #{entry.decisionIndex}
                      </span>
                      <span className={`proof-entry__dir is-${cls}`}>{dir}</span>
                      <span className="proof-entry__lev">
                        {entry.consensus.leverage}×
                      </span>
                      <span className="proof-entry__conf">
                        {entry.consensus.confidence}% conf
                      </span>
                      <span className="proof-entry__pubkey">
                        {entry.pubkey.toBase58().slice(0, 8)}…
                        {entry.pubkey.toBase58().slice(-8)}
                      </span>
                      <span
                        className={`proof-entry__exec ${
                          entry.executed ? "ok" : "skip"
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        {entry.executed ? "Executed" : "Logged"}
                      </span>
                      <span className="proof-entry__time">
                        {formatTimeAgo(entry.timestamp)}
                      </span>
                      <span className="proof-entry__arrow" aria-hidden="true">
                        <ExternalLink size={14} />
                      </span>
                    </a>
                  );
                })}
              </div>
              {pageCount > 1 && (
                <nav className="proof-pagination" aria-label="Proof pages">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  {Array.from({ length: pageCount }).map((_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        className={pageNumber === currentPage ? "is-active" : ""}
                        aria-current={pageNumber === currentPage ? "page" : undefined}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage === pageCount}
                  >
                    Next
                  </button>
                  <span>
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(currentPage * PAGE_SIZE, visibleEntries.length)} of{" "}
                    {visibleEntries.length}
                  </span>
                </nav>
              )}
            </>
          )}
        </main>

        <footer className="proof-footer-band">
          <Link href="/" className="proof-footer-link">
            <ArrowLeft size={14} /> Back to Fornex
          </Link>
          <span className="proof-footer-meta">
            Devnet only. No real funds. All claims verifiable on Solana
            Explorer.
          </span>
          <Link href="/app" className="proof-footer-link proof-footer-link--alt">
            Open App <ArrowRight size={14} />
          </Link>
        </footer>
      </div>
    </>
  );
}
