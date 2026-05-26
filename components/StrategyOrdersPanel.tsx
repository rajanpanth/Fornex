import { ExternalLink } from "lucide-react";
import { Decision } from "../lib/chain";

type AgentVoteKey = "bullVote" | "bearVote" | "zenVote";

const AGENTS: Array<{
  key: AgentVoteKey;
  name: string;
  icon: string;
}> = [
  { key: "bullVote", name: "BULL AGENT", icon: "🐂" },
  { key: "bearVote", name: "BEAR AGENT", icon: "🐻" },
  { key: "zenVote", name: "ZEN AGENT", icon: "⚖️" },
];

const directionLabel = (d: number) =>
  d === 1 ? "LONG" : d === 2 ? "SHORT" : "FLAT";

const directionClass = (d: number) =>
  d === 1 ? "direction-long" : d === 2 ? "direction-short" : "direction-flat";

const getStatus = (
  agentDir: number,
  consensusDir: number,
  executed: boolean
) => {
  if (!executed) return { label: "SKIPPED", cls: "amber" };
  if (agentDir === consensusDir) {
    return { label: "EXECUTED ✓", cls: "emerald" };
  }
  return { label: "VETOED ✗", cls: "crimson" };
};

export default function StrategyOrdersPanel({
  latestDecision,
}: {
  latestDecision: Decision | null;
}) {
  if (!latestDecision) {
    return (
      <div className="strategy-orders-panel">
        <div className="strategy-orders-head">
          <span>AI STRATEGY ORDERS</span>
          <small>Autonomous multi-agent consensus system</small>
        </div>
        <div className="strategy-empty">Waiting for on-chain decisions</div>
      </div>
    );
  }

  const consensusDir = latestDecision.consensus.direction;
  const agreeingCount = [
    latestDecision.bullVote,
    latestDecision.bearVote,
    latestDecision.zenVote,
  ].filter((vote) => vote.direction === consensusDir).length;

  return (
    <div className="strategy-orders-panel">
      <div className="strategy-orders-head">
        <span>AI STRATEGY ORDERS</span>
        <small>Autonomous multi-agent consensus system</small>
      </div>

      {AGENTS.map((agent) => {
        const vote = latestDecision[agent.key];
        const status = getStatus(
          vote.direction,
          consensusDir,
          latestDecision.executed
        );

        return (
          <div className="strategy-order-row" key={agent.key}>
            <div className="strategy-order-agent">
              <span className="strategy-agent-icon">{agent.icon}</span>
              <span>{agent.name}</span>
            </div>
            <div className="strategy-order-meta">
              <span className={directionClass(vote.direction)}>
                {directionLabel(vote.direction)}
              </span>
              <span>{vote.leverage}x leverage</span>
              <span>{vote.confidence}% confidence</span>
            </div>
            <p>&ldquo;{vote.reasoning || "No reasoning provided."}&rdquo;</p>
            <div className="strategy-status-line">
              <span>Status:</span>
              <strong className={`strategy-status ${status.cls}`}>
                {status.label}
              </strong>
            </div>
          </div>
        );
      })}

      <div
        className={`strategy-consensus ${
          latestDecision.executed ? "executed" : "skipped"
        }`}
      >
        <strong>
          CONSENSUS: {agreeingCount}/3 {directionLabel(consensusDir)} →{" "}
          {latestDecision.executed ? "Executed on Drift" : "Logged only"}
        </strong>
        <span>
          Confidence: {latestDecision.consensus.confidence}% · Leverage:{" "}
          {latestDecision.consensus.leverage}x
        </span>
        <a
          href={`https://explorer.solana.com/account/${latestDecision.pubkey.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Explorer <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
