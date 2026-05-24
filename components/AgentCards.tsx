import { useEffect, useRef, useState } from "react";

const AGENTS = [
  {
    emoji: "🐂",
    label: "BULL",
    cls: "bull",
    role: "Momentum Trader",
    desc: "Seeks entries when momentum is undeniable. Negative funding rates, rising open interest, and price confirmation are the signals BULL lives for.",
    stats: ["Bias: LONG", "Max Leverage: 3×", "Style: Aggressive"],
    signals: ["Funding Rate", "Open Interest", "Momentum"],
  },
  {
    emoji: "🐻",
    label: "BEAR",
    cls: "bear",
    role: "Contrarian Trader",
    desc: "Fades crowded trades and hunts for reversals. When longs are overextended and paying premium, BEAR sees opportunity where others see strength.",
    stats: ["Bias: SHORT/FLAT", "Max Leverage: 2×", "Style: Contrarian"],
    signals: ["L/S Ratio", "Funding Extremes", "Overcrowding"],
  },
  {
    emoji: "⚖️",
    label: "ZEN",
    cls: "zen",
    role: "Risk Manager",
    desc: "Only trades when risk/reward is pristine. Liquidation walls, spread tightness, and volatility conditions must align perfectly before ZEN commits.",
    stats: ["Bias: FLAT", "Max Leverage: 1.5×", "Style: Conservative"],
    signals: ["Liquidation Map", "Volatility", "Spread Analysis"],
  },
];

function ConsensusDiagram() {
  const ref = useRef<SVGSVGElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="consensus-diagram">
      <svg
        ref={ref}
        viewBox="0 0 700 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Agent boxes */}
        <rect className="diagram-box" x="10" y="10" width="120" height="36" />
        <text className="diagram-text" x="70" y="33" textAnchor="middle">
          🐂 BULL vote
        </text>

        <rect className="diagram-box" x="10" y="54" width="120" height="36" />
        <text className="diagram-text" x="70" y="77" textAnchor="middle">
          🐻 BEAR vote
        </text>

        <rect className="diagram-box" x="10" y="98" width="120" height="36" />
        <text className="diagram-text" x="70" y="121" textAnchor="middle">
          ⚖️ ZEN vote
        </text>

        {/* Lines from agents to consensus */}
        <path
          className={`diagram-line ${animate ? "animate" : ""}`}
          d="M130 28 L280 70"
          style={{ animationDelay: "0ms" }}
        />
        <path
          className={`diagram-line ${animate ? "animate" : ""}`}
          d="M130 72 L280 72"
          style={{ animationDelay: "150ms" }}
        />
        <path
          className={`diagram-line ${animate ? "animate" : ""}`}
          d="M130 116 L280 74"
          style={{ animationDelay: "300ms" }}
        />

        {/* Consensus box */}
        <rect className="diagram-box" x="280" y="48" width="170" height="48" />
        <text className="diagram-text-accent" x="365" y="68" textAnchor="middle">
          CONSENSUS ENGINE
        </text>
        <text className="diagram-text" x="365" y="84" textAnchor="middle" style={{ fontSize: 9 }}>
          (majority wins)
        </text>

        {/* Line from consensus to execution */}
        <path
          className={`diagram-line ${animate ? "animate" : ""}`}
          d="M450 72 L530 72"
          style={{ animationDelay: "600ms" }}
        />

        {/* Execution box */}
        <rect className="diagram-box" x="530" y="48" width="160" height="48" />
        <text className="diagram-text-accent" x="610" y="68" textAnchor="middle">
          DRIFT EXECUTION
        </text>
        <text className="diagram-text" x="610" y="84" textAnchor="middle" style={{ fontSize: 9 }}>
          (if conf {">"} 65%)
        </text>
      </svg>
    </div>
  );
}

export default function AgentCards() {
  return (
    <section id="agents" className="section-padding agents-section">
      <div className="section-center" style={{ textAlign: "center" }}>
        <div className="section-label">THE AGENTS</div>
        <h2 className="section-title">Three minds. One consensus.</h2>
        <p className="section-subtitle" style={{ margin: "0 auto 56px" }}>
          Each agent has a distinct trading personality and risk profile. They
          run in parallel, debate each trade, and the majority decision executes
          on Drift Protocol.
        </p>

        <div className="agent-showcase-grid">
          {AGENTS.map((a) => (
            <div key={a.label} className={`agent-showcase-card ${a.cls}`}>
              <div className="agent-sc-top">
                <span className="agent-sc-emoji">{a.emoji}</span>
                <span className={`agent-sc-label ${a.cls}`}>{a.label}</span>
              </div>
              <h3 className="agent-sc-title">{a.role}</h3>
              <p className="agent-sc-desc">{a.desc}</p>
              <div className="agent-sc-stats">
                {a.stats.map((s) => (
                  <span key={s} className="agent-sc-stat">
                    {s}
                  </span>
                ))}
              </div>
              <div className="agent-sc-signals">
                {a.signals.map((s) => (
                  <span key={s} className="signal-pill">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <ConsensusDiagram />
      </div>
    </section>
  );
}
