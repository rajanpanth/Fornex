import { ExternalLink } from "lucide-react";
import { Decision, dirLabel, formatTimeAgo } from "../lib/chain";

const AGENTS = [
  { key: "bullVote", label: "BULL SIGNAL", icon: "BULL" },
  { key: "bearVote", label: "BEAR SIGNAL", icon: "BEAR" },
  { key: "zenVote", label: "ZEN SIGNAL", icon: "ZEN" },
] as const;

export default function StrategyOrdersPanel({
  decision,
}: {
  decision: Decision | null;
}) {
  if (!decision) {
    return (
      <div className="strategy-orders-panel">
        <div className="strategy-orders-head">
          <span>AI STRATEGY ORDERS</span>
          <small>Waiting for chain data</small>
        </div>
      </div>
    );
  }

  const consensus = dirLabel(decision.consensus.direction);
  const executedCount = [
    decision.bullVote,
    decision.bearVote,
    decision.zenVote,
  ].filter((vote) => vote.direction === decision.consensus.direction).length;

  return (
    <div className="strategy-orders-panel">
      <div className="strategy-orders-head">
        <span>AI STRATEGY ORDERS</span>
        <small>Last updated: {formatTimeAgo(decision.timestamp)}</small>
      </div>

      {AGENTS.map((agent) => {
        const vote = decision[agent.key];
        const matches = vote.direction === decision.consensus.direction;
        return (
          <div className="strategy-order-row" key={agent.key}>
            <div className="strategy-order-title">
              <span>{agent.icon}</span>
              {agent.label}
              <strong className={`order-status ${matches ? "executed" : "vetoed"}`}>
                {matches ? "EXECUTED" : "VETOED"}
              </strong>
            </div>
            <div className="strategy-order-grid">
              <span>Direction: {dirLabel(vote.direction)}</span>
              <span>Leverage: {vote.leverage}x</span>
              <span>Confidence: {vote.confidence}%</span>
            </div>
            <p>&ldquo;{vote.reasoning || "No reasoning provided."}&rdquo;</p>
          </div>
        );
      })}

      <div className="strategy-consensus">
        <span>CONSENSUS RESULT</span>
        <strong>
          {executedCount}/3 {consensus} →{" "}
          {decision.executed ? "Executed" : "Logged"} at{" "}
          {new Date(decision.timestamp * 1000).toLocaleTimeString()}
        </strong>
        <a
          href={`https://explorer.solana.com/account/${decision.pubkey.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Explorer <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
