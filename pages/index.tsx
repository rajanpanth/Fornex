import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Connection } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CandlestickChart,
  CheckCircle2,
  Cpu,
  DatabaseZap,
  GitBranch,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  PROGRAM_ID,
  RPC_URL,
  decodeDecision,
  dirLabel,
  formatTimeAgo,
} from "../lib/chain";

const stats = [
  ["3", "Specialized agents"],
  ["24/7", "Autonomous execution"],
  ["100%", "On-chain decisions"],
  ["0", "Custody assumptions"],
];

const agents = [
  {
    name: "BULL",
    tone: "Momentum hunter",
    signal: "LONG SOL-PERP",
    confidence: "78%",
    copy: "Reads funding compression, open interest expansion, and support retests before proposing risk-on entries.",
  },
  {
    name: "BEAR",
    tone: "Risk sentinel",
    signal: "WAIT",
    confidence: "61%",
    copy: "Challenges crowded trades with liquidation maps, volatility bands, and rejection zones.",
  },
  {
    name: "ZEN",
    tone: "Portfolio governor",
    signal: "SIZE 1.5x",
    confidence: "72%",
    copy: "Balances conviction with drawdown limits, vault exposure, and market regime context.",
  },
];

const systems = [
  ["Decision Debate", "Three agents argue every setup before execution.", BrainCircuit],
  ["Drift Execution", "Perp orders route through a constrained strategy executor.", CandlestickChart],
  ["Solana Proof", "Trade intent, votes, and consensus are written on-chain.", DatabaseZap],
  ["Vault Controls", "Deposits stay transparent with no hidden discretionary layer.", ShieldCheck],
];

const timeline = [
  ["01", "Ingest", "Funding, OI, volatility, price action, and vault state stream into the agent brain."],
  ["02", "Debate", "BULL, BEAR, and ZEN produce competing recommendations with confidence scores."],
  ["03", "Govern", "Risk checks clamp leverage, position size, and drawdown exposure before any order."],
  ["04", "Prove", "Consensus and execution evidence are published for investors to audit forever."],
];

function MagneticLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 180, damping: 18, mass: 0.35 });

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) * 0.16);
        y.set((event.clientY - rect.top - rect.height / 2) * 0.22);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.div>
  );
}

function StageBackground() {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.35);
  const beamX = useTransform(mouseX, [0, 1], ["-16%", "16%"]);
  const beamY = useTransform(mouseY, [0, 1], ["-10%", "12%"]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      mouseX.set(event.clientX / window.innerWidth);
      mouseY.set(event.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [mouseX, mouseY]);

  return (
    <div className="cinema-stage" aria-hidden="true">
      <motion.div className="cinema-beam" style={{ x: beamX, y: beamY }} />
      <div className="cinema-grid" />
      <div className="cinema-vignette" />
      <div className="cinema-scanline" />
    </div>
  );
}

function CodeWindow() {
  return (
    <motion.div
      className="terminal-window hero-terminal"
      whileHover={{ y: -10, rotateX: 2, rotateY: -3 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="terminal-top">
        <span />
        <span />
        <span />
        <strong>fornex.agent.ts</strong>
      </div>
      <div className="terminal-body">
        <p><b>$</b> fornex run --market SOL-PERP</p>
        <p><i>BULL</i> funding inverted, momentum confirmed</p>
        <p><i>BEAR</i> resistance risk detected at 184.20</p>
        <p><i>ZEN</i> approve long, cap exposure at 1.5x</p>
        <p className="terminal-consensus">CONSENSUS: LONG · 72% · TX READY</p>
      </div>
    </motion.div>
  );
}

function LiveDecisionPreview() {
  const [liveDecisions, setLiveDecisions] = useState<Decision[]>([]);
  const [decisionCount, setDecisionCount] = useState<number | null>(null);
  const [nextLabel, setNextLabel] = useState("08:42");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLive() {
      try {
        const connection = new Connection(RPC_URL, "confirmed");
        const [currentAccounts, legacyAccounts] = await Promise.all([
          connection.getProgramAccounts(PROGRAM_ID, {
            filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
          }),
          connection.getProgramAccounts(PROGRAM_ID, {
            filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
          }),
        ]);
        const accounts = [...currentAccounts, ...legacyAccounts];
        const decoded = accounts
          .map(({ pubkey, account }) =>
            decodeDecision(pubkey, Buffer.from(account.data))
          )
          .filter(Boolean)
          .sort((a, b) => b!.timestamp - a!.timestamp)
          .slice(0, 3) as Decision[];

        if (!cancelled) {
          setLiveDecisions(decoded);
          setDecisionCount(accounts.length);
        }
      } catch (error) {
        console.warn("[landing] live decisions fetch failed", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchLive();
    const interval = setInterval(() => void fetchLive(), 30_000);
    const tick = setInterval(() => {
      const remaining = 900 - (Math.floor(Date.now() / 1000) % 900);
      setNextLabel(
        `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60)
          .toString()
          .padStart(2, "0")}`
      );
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  return (
    <section className="live-decisions-section">
      <div className="live-decisions-copy">
        <div className="section-kicker">LIVE ON-CHAIN NOW</div>
        <h2 className="section-heading">No wallet needed. Real decisions.</h2>
        <p className="section-copy">
          Stored permanently on Solana.
        </p>
        <div className="live-chain-counter">
          {decisionCount === null
            ? "Loading on-chain decisions…"
            : `${decisionCount} decisions on-chain`}{" "}
          {decisionCount !== null && `| Next in ${nextLabel}`}
        </div>
      </div>

      <div className="live-decision-grid">
        {loading && liveDecisions.length === 0 ? (
          <div className="live-decision-empty reveal">Reading Solana devnet...</div>
        ) : liveDecisions.length === 0 ? (
          <div className="live-decision-empty reveal">Waiting for on-chain decisions.</div>
        ) : (
          liveDecisions.map((decision) => {
            const direction = dirLabel(decision.consensus.direction);
            return (
              <Link
                href="/app"
                className={`live-decision-card reveal ${direction.toLowerCase()}`}
                key={decision.pubkey.toBase58()}
              >
                <div className="live-decision-top">
                  <span>{decision.market || "SOL-PERP"}</span>
                  <b>{formatTimeAgo(decision.timestamp)}</b>
                </div>
                <div className="live-decision-main">
                  <strong>{direction}</strong>
                  <span>BULL {dirLabel(decision.bullVote.direction)}</span>
                  <span>BEAR {dirLabel(decision.bearVote.direction)}</span>
                  <span>ZEN {dirLabel(decision.zenVote.direction)}</span>
                  <span>{decision.consensus.leverage}x</span>
                  <span>{decision.consensus.confidence}%</span>
                </div>
                <p>{decision.consensus.reasoning || "Consensus logged on-chain."}</p>
                <code>{decision.pubkey.toBase58()}</code>
              </Link>
            );
          })
        )}
      </div>

      <Link href="/app" className="live-decision-link">
        View all decisions <ArrowRight size={17} />
      </Link>
    </section>
  );
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Lock body scroll when nav overlay is open
  useEffect(() => {
    if (navOpen) {
      document.body.classList.add("nav-open");
    } else {
      document.body.classList.remove("nav-open");
    }
    return () => { document.body.classList.remove("nav-open"); };
  }, [navOpen]);

  useEffect(() => {
    let lenis: any;
    let rafId = 0;
    let ctx: any;

    async function bootMotion() {
      const Lenis = (await import("lenis")).default;
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");
      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        duration: 1.25,
        smoothWheel: true,
        wheelMultiplier: 0.82,
        touchMultiplier: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });

      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);

      ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el, index) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 70, filter: "blur(18px)" },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.15,
              delay: (index % 4) * 0.04,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 86%",
                end: "bottom 54%",
                toggleActions: "play none none reverse",
              },
            }
          );
        });

        gsap.utils.toArray<HTMLElement>(".parallax-slow").forEach((el) => {
          gsap.to(el, {
            yPercent: -14,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.1,
            },
          });
        });

        gsap.to(".kinetic-title", {
          backgroundPositionX: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: ".kinetic-title",
            start: "top 70%",
            end: "bottom 20%",
            scrub: 1,
          },
        });
      }, rootRef);
    }

    bootMotion();
    const onScroll = () => setScrolled(window.scrollY > 80);
    const onScrollCloseNav = () => setNavOpen(false);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScrollCloseNav, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScrollCloseNav);
      window.removeEventListener("keydown", onKeyDown);
      ctx?.revert();
      lenis?.destroy();
    };
  }, []);

  return (
    <>
      <Head>
        <title>Fornex Protocol - Autonomous AI Trading Agents</title>
        <meta
          name="description"
          content="Fornex is an institutional-grade AI trading agent platform where autonomous agents debate, execute, and prove every trade on Solana."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="cinematic-page" ref={rootRef}>
        <StageBackground />

        {/* Mobile nav overlay */}
        <div
          className={`mobile-nav-overlay${navOpen ? " open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            className="mobile-nav-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
          <a href="#agents" onClick={() => setNavOpen(false)}>Agents</a>
          <a href="#protocol" onClick={() => setNavOpen(false)}>Protocol</a>
          <a href="#proof" onClick={() => setNavOpen(false)}>Proof</a>
          <a href="#security" onClick={() => setNavOpen(false)}>Security</a>
          <Link href="/app" className="mobile-nav-launch" onClick={() => setNavOpen(false)}>
            Launch App <ArrowRight size={18} />
          </Link>
        </div>

        <header className={`cinematic-nav ${scrolled ? "is-scrolled" : ""}`}>
          <Link href="/" className="cinematic-logo">FORNEX</Link>
          <nav aria-label="Primary navigation">
            <a href="#agents">Agents</a>
            <a href="#protocol">Protocol</a>
            <a href="#proof">Proof</a>
            <a href="#security">Security</a>
          </nav>
          <Link href="/app" className="nav-pill">Launch App</Link>
          <button
            className="nav-hamburger"
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            onClick={() => setNavOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <main>
          <section className="cinema-hero">
            <div className="hero-copy">
              <motion.div
                className="eyebrow"
                initial={{ opacity: 0, y: 20, filter: "blur(12px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <span /> Autonomous Solana vault intelligence
              </motion.div>
              <motion.h1
                className="kinetic-title"
                initial={{ opacity: 0, y: 42, filter: "blur(18px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.05, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                AI agents that debate, trade, and prove every decision.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                Fornex turns trading strategy into an auditable multi-agent system:
                BULL, BEAR, and ZEN challenge each other before capital moves.
              </motion.p>
              <motion.div
                className="hero-actions"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <MagneticLink href="/app" className="primary-orbit">
                  Launch App <ArrowRight size={18} />
                </MagneticLink>
                <a className="ghost-orbit" href="#proof">
                  Inspect Proof <Sparkles size={17} />
                </a>
              </motion.div>
            </div>
            <div className="hero-visual parallax-slow">
              <CodeWindow />
              <div className="orbit-card orbit-card-a">
                <Bot size={18} /> 3 agents online
              </div>
              <div className="orbit-card orbit-card-b">
                <RadioTower size={18} /> Solana proof stream
              </div>
            </div>
          </section>

          <section className="metric-strip reveal">
            {stats.map(([value, label]) => (
              <div className="metric-tile" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>

          <section className="story-section" id="agents">
            <div className="section-kicker reveal">MULTI-AGENT GOVERNANCE</div>
            <h2 className="section-heading reveal">Three viewpoints. One constrained execution path.</h2>
            <div className="agent-cinema-grid">
              {agents.map((agent, index) => (
                <motion.article
                  className="glass-panel agent-panel reveal"
                  key={agent.name}
                  whileHover={{ y: -12, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 180, damping: 18 }}
                >
                  <div className="panel-index">0{index + 1}</div>
                  <h3>{agent.name}</h3>
                  <p className="agent-tone">{agent.tone}</p>
                  <div className="signal-row">
                    <span>{agent.signal}</span>
                    <b>{agent.confidence}</b>
                  </div>
                  <p>{agent.copy}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <LiveDecisionPreview />

          <section className="wide-product" id="protocol">
            <div className="section-kicker reveal">FROM SIGNAL TO EXECUTION</div>
            <h2 className="section-heading reveal">A trading floor compressed into a verifiable agent pipeline.</h2>
            <div className="product-grid">
              <div className="terminal-window big-terminal reveal">
                <div className="terminal-top">
                  <span />
                  <span />
                  <span />
                  <strong>consensus.log</strong>
                </div>
                <div className="terminal-body log-body">
                  {timeline.map(([step, title, copy]) => (
                    <div className="log-row" key={step}>
                      <b>{step}</b>
                      <div>
                        <strong>{title}</strong>
                        <p>{copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="systems-grid">
                {systems.map(([title, copy, Icon]) => (
                  <motion.div
                    className="glass-panel system-card reveal"
                    key={title as string}
                    whileHover={{ x: 8, borderColor: "rgba(219,255,108,0.42)" }}
                  >
                    <Icon size={24} />
                    <h3>{title as string}</h3>
                    <p>{copy as string}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section className="proof-section" id="proof">
            <div>
              <div className="section-kicker reveal">ON-CHAIN MEMORY</div>
              <h2 className="section-heading reveal">No black boxes. No unverifiable genius.</h2>
              <p className="section-copy reveal">
                Fornex records the reasoning trail, final consensus, market, direction,
                leverage, and execution reference so depositors can audit the agent brain
                after the trade, not just trust a dashboard.
              </p>
              <div className="proof-actions reveal">
                <a href="https://solscan.io" target="_blank" rel="noreferrer">
                  View Explorer <ArrowRight size={17} />
                </a>
                <Link href="/app">Open Vault <WalletCards size={17} /></Link>
              </div>
            </div>
            <div className="proof-stack">
              {[
                ["Consensus", "2/3 LONG", CheckCircle2],
                ["Program", "H6vbf...Xwf", GitBranch],
                ["Custody", "User-controlled", LockKeyhole],
                ["Runtime", "Agent heartbeat live", Cpu],
              ].map(([label, value, Icon]) => (
                <motion.div className="proof-card reveal" key={label as string} whileHover={{ y: -6 }}>
                  <Icon size={20} />
                  <span>{label as string}</span>
                  <strong>{value as string}</strong>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="security-section" id="security">
            <div className="security-copy reveal">
              <h2>Institutional-grade autonomy without surrendering control.</h2>
              <p>
                The platform is designed around constrained execution, transparent
                decision logs, and vault-level risk limits so agent intelligence never
                becomes agent discretion.
              </p>
            </div>
            <div className="security-rails">
              {["Non-custodial vault", "Leverage caps", "Auditable debates", "Emergency pause path"].map((item) => (
                <div className="rail reveal" key={item}>{item}</div>
              ))}
            </div>
          </section>

          <section className="final-cinema">
            <h2 className="reveal">Put autonomous capital to work with receipts.</h2>
            <MagneticLink href="/app" className="primary-orbit final-launch">
              Launch Fornex <ArrowRight size={18} />
            </MagneticLink>
          </section>
        </main>
      </div>
    </>
  );
}
