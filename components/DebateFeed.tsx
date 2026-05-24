import { useEffect, useState } from "react";
import { RefreshCcw, SignalHigh } from "lucide-react";
import { Decision } from "../lib/chain";
import DecisionCard from "./DecisionCard";

export default function DebateFeed({
  decisions,
}: {
  decisions: Decision[];
}) {
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Reset countdown when decisions change
  useEffect(() => {
    setCountdown(30);
  }, [decisions.length]);

  return (
    <div className="feed-panel">
      <div className="feed-header">
        <div className="feed-header-left">
          <span className="feed-title">
            <SignalHigh size={16} />
            AGENT DECISIONS
          </span>
          <span className="feed-live-badge">
            <span className="live-dot" />
            Live
          </span>
        </div>
        <span className="feed-countdown">
          <RefreshCcw size={14} />
          {countdown}s
        </span>
      </div>

      <div className="feed-body">
        {decisions.length === 0 ? (
          <div className="feed-empty">
            <span className="feed-empty-main">Scanning Markets…</span>
            <span className="feed-empty-sub">
              Waiting for first on-chain decision…
            </span>
          </div>
        ) : (
          decisions.map((d) => (
            <DecisionCard key={d.pubkey.toBase58()} decision={d} />
          ))
        )}
      </div>
    </div>
  );
}
