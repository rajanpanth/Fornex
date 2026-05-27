import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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
import LiveDecisionPreview from "../components/LiveDecisionPreview";
import HeroLiveTicker from "../components/HeroLiveTicker";
import dynamic from "next/dynamic";

// Lazy-load the trust strip — it makes RPC + /api calls and is below the fold,
// so we don't want it blocking SSR or fighting other on-page fetches.
const TrustStrip = dynamic(() => import("../components/TrustStrip"), {
  ssr: false,
  loading: () => <div className="trust-strip__skeleton" aria-hidden="true" />,
});

const stats = [
  ["3", "Specialized agents"],
  ["15m", "Autonomous cycle"],
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

const systems: Array<[string, string, typeof BrainCircuit]> = [
  ["Multi-agent consensus", "Three agents argue every setup before any order is sent.", BrainCircuit],
  ["Pyth market signals", "Funding, open interest, and price are pulled from verified oracle feeds.", RadioTower],
  ["Drift execution layer", "Perp orders route through a constrained strategy executor on Drift.", CandlestickChart],
  ["On-chain decision PDAs", "Reasoning, votes, and consensus are written to Solana decision accounts.", DatabaseZap],
];

const timeline = [
  ["01", "Ingest", "Funding, OI, volatility, price action, and vault state stream into the agent brain."],
  ["02", "Debate", "BULL, BEAR, and ZEN produce competing recommendations with confidence scores."],
  ["03", "Govern", "Risk checks clamp leverage, position size, and drawdown exposure before any order."],
  ["04", "Prove", "Consensus, votes, and execution reference are written on-chain for permanent audit."],
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
        <title>Fornex — Autonomous AI trading vault on Solana</title>
        <meta
          name="description"
          content="Fornex is an autonomous AI trading vault on Solana devnet. A multi-agent brain runs every 15 minutes; every decision is written on-chain and verifiable."
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
          <Link href="/proof" className="mobile-nav-link" onClick={() => setNavOpen(false)}>
            On-chain proof
          </Link>
          <Link href="/app" className="mobile-nav-launch" onClick={() => setNavOpen(false)}>
            Launch App <ArrowRight size={18} />
          </Link>
        </div>

        <header className={`cinematic-nav ${scrolled ? "is-scrolled" : ""}`}>
          <Link href="/" className="cinematic-logo">FORNEX</Link>
          <nav aria-label="Primary navigation">
            <a href="#agents">Agents</a>
            <a href="#protocol">Protocol</a>
            <a href="#security">Security</a>
            <Link href="/proof">Proof</Link>
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
                <span /> Autonomous AI trading vault · Solana devnet
              </motion.div>
              <motion.h1
                className="kinetic-title"
                initial={{ opacity: 0, y: 42, filter: "blur(18px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.05, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                AI agents that debate, trade, and prove every decision on-chain.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                Three specialized agents run every 15 minutes. They argue,
                vote, and a constrained executor places the trade on Drift.
                Every reasoning step lands in a Solana decision account.
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
                <Link className="ghost-orbit" href="/proof">
                  View live proof <Sparkles size={17} />
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <HeroLiveTicker />
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

          {/* Trust strip — full-width band so it doesn't fight the hero column. */}
          <section className="trust-band reveal">
            <TrustStrip variant="landing" />
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

          <section className="why-hard reveal" id="why-hard">
            <div className="section-kicker">WHY THIS IS HARD</div>
            <h2 className="section-heading">The problem the protocol actually solves.</h2>
            <div className="why-grid">
              {[
                {
                  k: "Agent drift",
                  v: "LLM agents hallucinate confidently. Fornex forces them to vote and bounds every output through risk caps.",
                },
                {
                  k: "Unverifiable strategies",
                  v: "Most AI vaults are black boxes. Reasoning is logged on-chain so depositors can audit the brain, not just trust a screenshot.",
                },
                {
                  k: "Execution gap",
                  v: "Going from prediction to perp order is the failure point. Drift execution sits behind a constrained strategy layer.",
                },
                {
                  k: "Operational reliability",
                  v: "PM2-supervised runtime keeps the cycle alive. Heartbeats, retries, and on-chain receipts make outages obvious.",
                },
              ].map((row) => (
                <div className="why-card" key={row.k}>
                  <strong>{row.k}</strong>
                  <p>{row.v}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="proof-section" id="proof">
            <div>
              <div className="section-kicker reveal">ON-CHAIN MEMORY</div>
              <h2 className="section-heading reveal">No black boxes. No unverifiable genius.</h2>
              <p className="section-copy reveal">
                Fornex records the reasoning trail, final consensus, market,
                direction, leverage, and execution reference so depositors can
                audit the agent brain after the trade, not just trust a
                dashboard.
              </p>
              <div className="proof-actions reveal">
                <Link href="/proof">
                  Inspect on-chain decisions <ArrowRight size={17} />
                </Link>
                <Link href="/app">Open Vault <WalletCards size={17} /></Link>
              </div>
            </div>
            <div className="proof-stack">
              {[
                ["Consensus", "2/3 LONG", CheckCircle2],
                ["Program", "H6vbf…6vZf", GitBranch],
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
                The platform is designed around constrained execution,
                transparent decision logs, and vault-level risk limits so agent
                intelligence never becomes agent discretion.
              </p>
            </div>
            <div className="security-rails">
              {[
                "Non-custodial vault",
                "Leverage caps",
                "Auditable debates",
                "Emergency pause path",
              ].map((item) => (
                <div className="rail reveal" key={item}>{item}</div>
              ))}
            </div>
          </section>

          <section className="final-cinema">
            <div className="section-kicker reveal">READY WHEN YOU ARE</div>
            <h2 className="reveal">Put autonomous capital to work with receipts.</h2>
            <p className="section-copy reveal" style={{ margin: "0 auto 32px" }}>
              Devnet only. No real funds, no yield guarantees, no audited
              claims. Just an honest AI vault with on-chain proof.
            </p>
            <div className="final-actions">
              <MagneticLink href="/app" className="primary-orbit final-launch">
                Launch Fornex <ArrowRight size={18} />
              </MagneticLink>
              <Link href="/proof" className="ghost-orbit">
                View on-chain proof <Sparkles size={17} />
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
