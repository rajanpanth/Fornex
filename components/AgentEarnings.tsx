import { useEffect, useMemo, useRef, useState } from "react";
import { Coins } from "lucide-react";

export default function AgentEarnings({
  trades,
  winRate,
  cycle,
}: {
  trades: number;
  winRate: number;
  cycle: { label: string; progress: number; thinking: boolean };
}) {
  const targetEarnings = useMemo(() => trades * 0.001, [trades]);
  const [displayed, setDisplayed] = useState(0);
  const [flash, setFlash] = useState(false);
  const prevTradesRef = useRef(trades);
  const animRef = useRef<number | null>(null);

  // Animate earnings counter
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = displayed;
    const end = targetEarnings;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    // Flash on new trade
    if (trades > prevTradesRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
    }
    prevTradesRef.current = trades;

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEarnings]);

  return (
    <div className="earnings-panel">
      <div className="earnings-header">
        <span className="earnings-title">
          <Coins size={16} />
          AGENT EARNINGS
        </span>
      </div>

      <div className={`earnings-big${flash ? " flash" : ""}`}>
        {displayed.toFixed(3)} SOL
      </div>
      <div className="earnings-sub">earned by agent via pay.sh</div>

      <div className="earnings-rows">
        <div className="earnings-row">
          <span className="earnings-row-label">Rate</span>
          <span className="earnings-row-val">0.001 SOL/trade</span>
        </div>
        <div className="earnings-row">
          <span className="earnings-row-label">Total trades</span>
          <span className="earnings-row-val">{trades}</span>
        </div>
        <div className="earnings-row">
          <span className="earnings-row-label">Win rate</span>
          <span className="earnings-row-val">{winRate}%</span>
        </div>
      </div>

      <div className="cycle-block">
        <div className="cycle-header">
          <span>Next cycle</span>
          <span className={cycle.thinking ? "thinking" : ""}>{cycle.label}</span>
        </div>
        <div className="cycle-track">
          <div
            className="cycle-fill"
            style={{ width: `${Math.max(0, 100 - cycle.progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="agent-online">
        <span className="live-dot" />
        AGENT ONLINE
      </div>
    </div>
  );
}
