import { useEffect, useRef, useState } from "react";

const BULL_REASONING = 'Funding rate -0.03%/hr signals shorts crowded. OI up 18% in 4h.';

export default function HeroCard() {
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    // Delay typewriter to let card animate in first
    const delay = setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTypedText(BULL_REASONING.slice(0, i));
        if (i >= BULL_REASONING.length) {
          clearInterval(interval);
          // Hide cursor after finishing
          setTimeout(() => setShowCursor(false), 2000);
        }
      }, 35);
      return () => clearInterval(interval);
    }, 1800);
    return () => clearTimeout(delay);
  }, []);

  return (
    <div className="hero-preview">
      <div className="hero-preview-header">
        <span className="hero-preview-header-left">
          🧠 Agent Decision — SOL-PERP
        </span>
        <span className="hero-preview-header-right">2 min ago</span>
      </div>

      {/* BULL */}
      <div className="hero-preview-row">
        <div className="hero-preview-row-top">
          <span className="hero-agent-name">🐂 BULL</span>
          <span className="hero-badge long">LONG</span>
          <span className="hero-badge-lev">2×</span>
          <span className="hero-badge-conf">78%</span>
        </div>
        <div className="hero-preview-reasoning">
          {typedText}
          {showCursor && <span className="typewriter-cursor" />}
        </div>
      </div>

      {/* BEAR */}
      <div className="hero-preview-row">
        <div className="hero-preview-row-top">
          <span className="hero-agent-name">🐻 BEAR</span>
          <span className="hero-badge flat">FLAT</span>
          <span className="hero-badge-lev"></span>
          <span className="hero-badge-conf">61%</span>
        </div>
        <div className="hero-preview-reasoning">
          Price rejected $180 resistance twice this session
        </div>
      </div>

      {/* ZEN */}
      <div className="hero-preview-row">
        <div className="hero-preview-row-top">
          <span className="hero-agent-name">⚖️ ZEN</span>
          <span className="hero-badge long">LONG</span>
          <span className="hero-badge-lev">1.5×</span>
          <span className="hero-badge-conf">72%</span>
        </div>
        <div className="hero-preview-reasoning">
          Liquidation wall at $162 provides strong support
        </div>
      </div>

      <div className="hero-preview-footer">
        CONSENSUS: 2/3 LONG → Executed on Drift Protocol
      </div>
    </div>
  );
}
