import { ExternalLink } from "lucide-react";
import { Decision } from "../lib/chain";

type AgentVoteKey = "bullVote" | "bearVote" | "zenVote";

const AGENTS: Array<{
  key: AgentVoteKey;
  name: string;
  label: string;
}> = [
  { key: "bullVote", name: "BULL", label: "B" },
  { key: "bearVote", name: "BEAR", label: "R" },
  { key: "zenVote", name: "ZEN", label: "Z" },
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
  if (!executed) return { label: "Logged", cls: "amber" };
  if (agentDir === consensusDir) {
    return { label: "Executed", cls: "emerald" };
  }
  return { label: "Vetoed", cls: "neutral" };
};

const shortReason = (reasoning: string) => {
  const text = reasoning.trim() || "No reasoning provided.";
  return text.length > 112 ? `${text.slice(0, 109).trim()}...` : text;
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
          <span>Agent orders</span>
          <small>Waiting for consensus</small>
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
        <span>Agent orders</span>
        <small>Latest on-chain decision</small>
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
              <span className="strategy-agent-icon">{agent.label}</span>
              <span>{agent.name}</span>
              <strong className={`strategy-status ${status.cls}`}>
                {status.label}
              </strong>
            </div>
            <div className="strategy-order-meta">
              <span className={directionClass(vote.direction)}>
                {directionLabel(vote.direction)}
              </span>
              <span>{vote.leverage}x</span>
              <span>{vote.confidence}%</span>
            </div>
            <p>{shortReason(vote.reasoning)}</p>
          </div>
        );
      })}

      <div
        className={`strategy-consensus ${
          latestDecision.executed ? "executed" : "skipped"
        }`}
      >
        <strong>
          {agreeingCount}/3 {directionLabel(consensusDir)} ·{" "}
          {latestDecision.executed ? "Executed" : "Logged"}
        </strong>
        <span>
          {latestDecision.consensus.confidence}% conf ·{" "}
          {latestDecision.consensus.leverage}x
        </span>
        <a
          href={`https://explorer.solana.com/account/${latestDecision.pubkey.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Explorer <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
