import Head from "next/head";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

/**
 * /judges - a single page judges can grade in 90 seconds.
 *
 * Layout follows the pattern that hackathon submissions consistently win on:
 *   1. Honest TL;DR - what we are, what we are not.
 *   2. Built-on strip - every dependency named.
 *   3. FAQ - every "is this real?" question answered with a link.
 *   4. On-chain proof table - every account a judge would want to inspect.
 *
 * Every claim on this page is grounded in the repo. Nothing aspirational.
 */

const PROGRAM_ID = "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf";
const VAULT_PDA = "HMkL7zzAroE919esVY6HSMYzB2ejHM5m4A8JKCSrgBXR";
const FNRX_MINT = "BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj";
const AGENT_WALLET = "2BD1hDEQ81HfPZApA6ypR3tVMXLdP4dLMUi8sjFiNu3n";
const TREASURY_WALLET = "HHy34m2dCJkrX3SDCh2zVKtHWXmxeeMzZNGkEZx2oYat";

const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;

/**
 * Treasury source provenance. Mirrors `FORNEX_TREASURY_SOURCE` in the
 * agent runtime. Devnet stays on a hot keypair; mainnet plan is to make
 * the keypair a delegate spender that's topped up from a Squads multisig
 * vault on a recurring budget. See README "Treasury safety" + agent/src/paysh.ts.
 */
const TREASURY_SOURCE_RAW =
  (process.env.NEXT_PUBLIC_FORNEX_TREASURY_SOURCE as string | undefined) ??
  "treasury";

function describeTreasurySource(raw: string): {
  label: string;
  body: string;
  href?: string;
} {
  if (raw.startsWith("squads:")) {
    const multisig = raw.slice("squads:".length);
    return {
      label: "Squads multisig",
      body: `Hot keypair acts as delegate spender; the source of funds is a Squads vault that drips a monthly budget to the keypair via scheduled vault_transaction. Multisig: ${multisig.slice(0, 4)}…${multisig.slice(-4)}.`,
      href: explorerAddress(multisig),
    };
  }
  return {
    label: "Devnet hot keypair",
    body: "Single signer (FORNEX_TREASURY_KEYPAIR) topped up via the Solana faucet. Audit-friendly: every transfer is on chain, the wallet is publicly known, no real-money exposure.",
  };
}

const tldr: Array<{ k: string; v: string }> = [
  {
    k: "What it is",
    v: "A non-custodial Solana vault where three specialized AI agents (BULL, BEAR, ZEN) debate every 15 minutes and a constrained executor opens a perp position. Every cap is enforced inside an Anchor program; the agent cannot break them.",
  },
  {
    k: "What proves it",
    v: "Each cycle writes a MultiAgentDecision PDA with the full BULL/BEAR/ZEN reasoning, a SyntheticPosition PDA price-marked against Pyth, a NavRecord PDA on close, and a real treasury → agent SOL transfer (pay.sh stream).",
  },
  {
    k: "What we are not",
    v: "We are not a CEX bot, not a custodial yield product, not an audited mainnet protocol, and not running real money. Devnet only. Every claim on this page is verifiable on Solana Explorer.",
  },
  {
    k: "What's novel",
    v: "Multi-agent governance + on-chain caps + Pyth-marked synthetic perps + per-trade streaming agent payments, all on one Solana program. We did not find another submission with all four primitives wired together.",
  },
];

const builtOn: Array<{ k: string; v: string; href?: string }> = [
  { k: "Solana", v: "Devnet · chain runtime", href: "https://solana.com" },
  { k: "Anchor 0.30", v: "Program framework", href: "https://www.anchor-lang.com" },
  { k: "Pyth", v: "SOL/USD price oracle for synthetic perps", href: "https://pyth.network" },
  { k: "Drift Protocol", v: "Live perp execution path (gated by env)", href: "https://drift.trade" },
  { k: "GPT-4o (Azure)", v: "Three parallel system prompts per cycle" },
  { k: "Phantom + Solflare", v: "Wallet adapter on the dashboard" },
  { k: "Helius", v: "RPC + (planned) WebSocket decision feed" },
  { k: "Next.js + Vercel", v: "Frontend + API routes" },
  { k: "PM2", v: "Agent runtime supervisor" },
  { k: "@fornex/sdk", v: "Read-only TS client (packages/sdk)" },
];

const faq: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What stops the agent from breaking the leverage cap?",
    a: (
      <>
        The Anchor program. <code>log_multi_agent_decision</code> rejects any
        BULL vote with leverage &gt; 3, any BEAR or ZEN vote &gt; 2, and any
        consensus with confidence &lt; 60%. <code>update_nav</code> rejects
        any write outside ±10% per cycle. <code>record_trade_outcome</code>{" "}
        rejects any single-trade PnL beyond ±50% of NAV. Caps live in the
        program, not the agent - see <code>programs/fornex/src/errors.rs</code>.
      </>
    ),
  },
  {
    q: "Why synthetic perps instead of just Drift?",
    a: (
      <>
        Drift devnet has been intermittent. We built a self-contained
        <code> SyntheticPosition</code> PDA that opens with a Pyth-stamped
        entry price, closes against a Pyth-stamped exit, and computes
        realized PnL directly in the Anchor program. No external dex
        dependency. The Drift executor is wired and switchable via{" "}
        <code>FORNEX_EXECUTOR=drift</code> when devnet is healthy.
      </>
    ),
  },
  {
    q: "Where does pay.sh money come from? Is it a self-transfer?",
    a: (
      <>
        Real on-chain <code>SystemProgram::transfer</code> from a separate
        treasury keypair to the agent wallet, on every executed trade. The
        treasury is funded once on devnet; if the env var is missing the
        code refuses to fake a self-transfer (see{" "}
        <code>agent/src/paysh.ts</code>). Click any pay.sh tx on the proof
        page - the <code>From</code> account is{" "}
        <a href={explorerAddress(TREASURY_WALLET)} target="_blank" rel="noopener noreferrer">
          treasury
        </a>
        , not the agent.
      </>
    ),
  },
  {
    q: "What does the agent wallet hold?",
    a: (
      <>
        On devnet, the agent wallet holds a small float of SOL it uses to
        execute Drift orders and to pay tx fees for on-chain logging. User
        deposits live in the Vault PDA, not the agent wallet. The mainnet
        plan is for the Vault PDA to CPI into Drift via signer seeds so the
        agent never custodies user funds.
      </>
    ),
  },
  {
    q: "Is the AI reasoning stored on-chain or just hashed?",
    a: (
      <>
        Stored, not hashed. Each <code>AgentVote</code> reserves 200 bytes
        for reasoning text, and every <code>MultiAgentDecision</code> PDA
        carries three of them - BULL, BEAR, ZEN - plus the consensus.
        That&apos;s the wall on <Link href="/proof">/proof</Link>. Truncation is
        documented in <code>agent/src/config.ts</code>.
      </>
    ),
  },
  {
    q: "Why does the win-rate stat actually mean something?",
    a: (
      <>
        It&apos;s derived from <code>record_trade_outcome</code>, which only
        increments on closed positions with realized PnL. Deposits never
        count toward win-rate. The inception NAV is stamped on-chain at
        first deposit so every PnL number on the dashboard is anchored to a
        real on-chain start point.
      </>
    ),
  },
  {
    q: "Can I run this myself?",
    a: (
      <>
        Yes. <code>git clone</code>, <code>npm install</code>,{" "}
        <code>anchor build</code>, fund a devnet keypair, set the env vars
        listed in <code>.env.local.example</code> and{" "}
        <code>agent/.env.example</code>, then <code>npm run dev</code> and{" "}
        <code>npm run agent</code>. Single-cycle and force-direction flags
        are documented in <code>DEMO_SCRIPT.md</code>.
      </>
    ),
  },
  {
    q: "What happens if the LLM goes down?",
    a: (
      <>
        The cycle returns a safe FLAT vote per agent, the consensus comes
        out FLAT, and the on-chain log records that explicitly. No order
        is placed. Operational status (Pyth, RPC, agent heartbeat) is
        surfaced on the dashboard topbar.
      </>
    ),
  },
  {
    q: "Does the dashboard ever invent numbers?",
    a: (
      <>
        No. NAV, share supply, decision count, win-rate, executed-trade
        count, and pay.sh streamed are all decoded directly from the Vault
        PDA + program account list. Source: <code>lib/chain.ts</code> and{" "}
        <code>components/TrustStrip.tsx</code>.
      </>
    ),
  },
  {
    q: "How does the dashboard get live updates without a backend?",
    a: (
      <>
        The dashboard opens a <code>logsSubscribe</code> WebSocket directly
        to the configured Solana RPC and filters for log lines that mention
        Fornex instructions ({"`log_multi_agent_decision`"},{" "}
        {"`record_trade_outcome`"}, {"`update_agent_reputation`"},{" "}
        synthetic open/close). When a match arrives, the relevant page
        re-fetches. Auto-reconnects with capped exponential backoff.
        Source: <code>hooks/useDecisionStream.ts</code>.
      </>
    ),
  },
  {
    q: "Can I read Fornex state from my own app?",
    a: (
      <>
        Yes. The repo ships{" "}
        <code>@fornex/sdk</code> at <code>packages/sdk/</code> - a tiny
        read-only TypeScript client with peer dep <code>@solana/web3.js</code>{" "}
        only. <code>getVault</code>, <code>getDecisions</code>,{" "}
        <code>getNavHistory</code>, <code>getAgentReputation</code>, and{" "}
        <code>getVaultStrategy</code> cover every Fornex PDA in one line.
      </>
    ),
  },
];

const proofTable: Array<{
  what: string;
  where: string;
  href: string;
  internal?: boolean;
}> = [
  { what: "Anchor program", where: PROGRAM_ID, href: explorerAddress(PROGRAM_ID) },
  { what: "Vault PDA", where: VAULT_PDA, href: explorerAddress(VAULT_PDA) },
  { what: "$FNRX mint", where: FNRX_MINT, href: explorerAddress(FNRX_MINT) },
  { what: "Agent wallet", where: AGENT_WALLET, href: explorerAddress(AGENT_WALLET) },
  { what: "Treasury wallet", where: TREASURY_WALLET, href: explorerAddress(TREASURY_WALLET) },
  { what: "All decisions, decoded", where: "/proof", href: "/proof", internal: true },
];

export default function JudgesPage() {
  return (
    <>
      <Head>
        <title>Fornex - For judge</title>
        <meta
          name="description"
          content="Fornex in 90 seconds - what it is, what proves it, what's novel. Every claim resolves to an on-chain account on Solana devnet."
        />
      </Head>
      <div className="judges-page">
        <header className="judges-topbar">
          <Link href="/" className="judges-topbar__logo">FORNEX</Link>
          <nav aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/app">App</Link>
            <Link href="/proof">Proof</Link>
            <Link href="/judges" aria-current="page">For judge</Link>
          </nav>
          <Link href="/app" className="judges-topbar__cta">
            Launch App <ArrowRight size={15} />
          </Link>
        </header>

        <main className="judges-main">
          <section className="judges-hero">
            <div className="judges-hero__kicker">
              <ShieldCheck size={13} />
              FAQ
            </div>
            <h1>Fornex - what it is, what proves it.</h1>
            <p>
              Solana devnet only. Multi-agent AI vault with caps enforced
              inside an Anchor program and per-trade streaming payments to
              the agent operator. Every claim on this page resolves to a
              real on-chain account. No staging server, no mock data.
            </p>
          </section>

          <section className="judges-tldr">
            <h2 className="judges-h2">TL;DR</h2>
            <div className="judges-tldr__grid">
              {tldr.map((row) => (
                <div className="judges-tldr__card" key={row.k}>
                  <strong>{row.k}</strong>
                  <p>{row.v}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="judges-built-on">
            <h2 className="judges-h2">Built on</h2>
            <ul className="judges-built-on__list">
              {builtOn.map((row) => (
                <li key={row.k}>
                  {row.href ? (
                    <a href={row.href} target="_blank" rel="noopener noreferrer">
                      <strong>{row.k}</strong>
                      <span>{row.v}</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <div>
                      <strong>{row.k}</strong>
                      <span>{row.v}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="judges-faq">
            <h2 className="judges-h2">FAQ</h2>
            <ol className="judges-faq__list">
              {faq.map((row) => (
                <li key={row.q}>
                  <h3>{row.q}</h3>
                  <div>{row.a}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="judges-proof">
            <h2 className="judges-h2">On-chain proof table</h2>
            <p className="judges-proof__sub">
              Every row opens Solana Explorer on devnet at the exact account.
            </p>
            <div className="judges-proof__table">
              {proofTable.map((row) => {
                const inner = (
                  <>
                    <span className="judges-proof__what">
                      <CheckCircle2 size={14} /> {row.what}
                    </span>
                    <span className="judges-proof__where">{row.where}</span>
                    <span className="judges-proof__arrow">
                      {row.internal ? (
                        <ArrowRight size={14} />
                      ) : (
                        <ExternalLink size={14} />
                      )}
                    </span>
                  </>
                );
                return row.internal ? (
                  <Link key={row.what} href={row.href} className="judges-proof__row">
                    {inner}
                  </Link>
                ) : (
                  <a
                    key={row.what}
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="judges-proof__row"
                  >
                    {inner}
                  </a>
                );
              })}
            </div>
          </section>

          <section className="judges-treasury">
            <h2 className="judges-h2">Treasury safety</h2>
            <TreasuryCallout source={TREASURY_SOURCE_RAW} />
          </section>

          <section className="judges-cta">
            <Link href="/" className="judges-cta__back">
              <ArrowLeft size={14} /> Back to landing
            </Link>
            <Link href="/proof" className="judges-cta__primary">
              See the wall <ArrowRight size={14} />
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}

function TreasuryCallout({ source }: { source: string }) {
  const { label, body, href } = describeTreasurySource(source);
  const isSquads = source.startsWith("squads:");
  return (
    <div className={`treasury-callout treasury-callout--${isSquads ? "squads" : "hot"}`}>
      <header>
        <span className="treasury-callout__chip">{label}</span>
        <span className="treasury-callout__title">
          The agent does not custody trading capital. The treasury does not
          custody the agent&apos;s float.
        </span>
      </header>
      <p>{body}</p>
      <ul>
        <li>
          <strong>Devnet</strong>: hot keypair signer · 0.001 SOL per executed
          trade · audit by clicking the &quot;pay.sh streamed&quot; tile on{" "}
          <Link href="/app">/app</Link>.
        </li>
        <li>
          <strong>Mainnet plan</strong>: same keypair, but funded by a Squads
          multisig that signs a monthly top-up. Compromise of the hot key
          bounds blast radius to the residual budget, never the multisig
          vault.
        </li>
        <li>
          <strong>Verification</strong>:{" "}
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              open the Squads vault on Explorer <ExternalLink size={11} />
            </a>
          ) : (
            <>
              every <code>SystemProgram::transfer</code> is signed by the
              treasury keypair, not the agent. Source code:{" "}
              <code>agent/src/paysh.ts</code>.
            </>
          )}
        </li>
      </ul>
    </div>
  );
}
