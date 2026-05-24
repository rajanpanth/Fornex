import { useEffect, useRef, useState } from "react";

const LINES = [
  { field: "Account:", value: "MultiAgentDecision", isString: false },
  { field: "Program:", value: "Fornex Protocol", isString: false },
  { divider: true },
  { field: "bull_direction:", value: "LONG", isString: false },
  { field: "bull_leverage:", value: "2", isString: false },
  { field: "bull_confidence:", value: "78", isString: false },
  {
    field: "bull_reasoning:",
    value: '"Funding rate -0.03%/hr signals shorts overcrowded. OI up 18%."',
    isString: true,
  },
  { divider: true },
  { field: "bear_direction:", value: "FLAT", isString: false },
  { field: "bear_confidence:", value: "61", isString: false },
  {
    field: "bear_reasoning:",
    value: '"Price rejected $180 resistance twice this session."',
    isString: true,
  },
  { divider: true },
  { field: "consensus:", value: "LONG", isString: false },
  { field: "executed:", value: "true", isString: false },
  { field: "timestamp:", value: "now", isString: false },
];

export default function OnChainProof() {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          // Reveal lines one at a time
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setVisibleLines(i);
            if (i >= LINES.length) clearInterval(interval);
          }, 80);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="on-chain" className="section-padding onchain-section">
      <div className="section-center" style={{ textAlign: "center" }}>
        <div className="section-label">ON-CHAIN TRANSPARENCY</div>
        <h2 className="section-title">
          Every argument. Permanent. Verifiable.
        </h2>
        <p className="onchain-subtitle">
          Other AI vaults are black boxes. Fornex stores every agent&apos;s
          reasoning — every vote, every disagreement — permanently on the Solana
          blockchain. Not in a database. On-chain. Auditable by anyone. Forever.
        </p>

        <div className="onchain-terminal" ref={ref}>
          {LINES.slice(0, visibleLines).map((line, i) => {
            if ((line as any).divider) {
              return <hr key={i} className="onchain-divider" />;
            }
            const l = line as {
              field: string;
              value: string;
              isString: boolean;
            };
            return (
              <div key={i} style={{ textAlign: "left" }}>
                <span className="onchain-field">{l.field} </span>
                <span className={l.isString ? "onchain-string" : "onchain-value"}>
                  {l.value}
                </span>
              </div>
            );
          })}
          {visibleLines > 0 && visibleLines < LINES.length && (
            <span className="typewriter-cursor" />
          )}
          {visibleLines >= LINES.length && (
            <>
              <hr className="onchain-divider" />
              <a
                className="onchain-link"
                href="https://solscan.io/"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Solana Explorer ↗
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
