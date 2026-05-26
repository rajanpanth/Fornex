import { useState } from "react";
import { Bot, ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";
import { Decision, dirLabel, formatTimeAgo } from "../lib/chain";

function AgentRow({
  name,
  vote,
}: {
  name: string;
  vote: {
    direction: number;
    leverage: number;
    confidence: number;
    reasoning: string;
    reasoningBytes: number[];
  };
}) {
  const dir = dirLabel(vote.direction).toLowerCase();
  return (
    <div className="dc-agent-row">
      <span className="dc-agent-name">
        <span className="dc-agent-avatar">{name.slice(0, 1)}</span>
        {name}
      </span>
      <span className={`dc-agent-badge ${dir}`}>
        {dirLabel(vote.direction)}
      </span>
      <span className="dc-agent-conf">{vote.confidence}%</span>
      <span className="dc-agent-reasoning">
        &ldquo;{vote.reasoning || "No reasoning provided."}&rdquo;
      </span>
      <span className="dc-agent-meter">
        <span style={{ width: `${vote.confidence}%` }} />
      </span>
    </div>
  );
}

function getConsensusBadge(
  bull: number,
  bear: number,
  zen: number
): { label: string; cls: string } {
  const votes = [bull, bear, zen];
  const allSame = votes.every((vote) => vote === votes[0]);
  const zenFlat = zen === 0;
  const bullAlone = bull !== bear && bull !== zen;
  const bearAlone = bear !== bull && bear !== zen;

  if (allSame) return { label: "⚡ UNANIMOUS", cls: "emerald" };
  if (zenFlat && bull !== 0 && bear !== 0 && bull === bear) {
    return { label: "⚠️ ZEN VETOED", cls: "amber" };
  }
  if (bullAlone) return { label: "🐂 BULL OVERRULED", cls: "blue" };
  if (bearAlone) return { label: "🐻 BEAR OVERRULED", cls: "blue" };
  return { label: "2/3 MAJORITY", cls: "default" };
}

export default function DecisionCard({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false);
  const dir = dirLabel(decision.consensus.direction);
  const cls = dir.toLowerCase();
  const timeAgo = formatTimeAgo(decision.timestamp);

  const votes = [decision.bullVote, decision.bearVote, decision.zenVote];
  const longCount = votes.filter((v) => v.direction === 1).length;
  const shortCount = votes.filter((v) => v.direction === 2).length;
  const flatCount = votes.filter((v) => v.direction === 0).length;
  const consensusBadge = getConsensusBadge(
    decision.bullVote.direction,
    decision.bearVote.direction,
    decision.zenVote.direction
  );

  const consensusStr =
    dir === "LONG"
      ? `${longCount}/3 LONG`
      : dir === "SHORT"
      ? `${shortCount}/3 SHORT`
      : "FLAT";
  const sameDirection = votes.filter(
    (v) => v.direction === decision.consensus.direction
  ).length;

  const footerCls = decision.executed
    ? dir === "LONG"
      ? "long-executed"
      : dir === "SHORT"
      ? "short-executed"
      : ""
    : "";

  return (
    <article className={`decision-card ${cls}${expanded ? " expanded" : ""}`}>
      <div
        className="decision-card-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
      >
        <span className="dc-brain-icon">
          <Bot size={17} />
        </span>
        <span className={`dir-badge ${cls}`}>{dir}</span>
        <span className={`dc-disagreement badge-${consensusBadge.cls}`}>
          {consensusBadge.label}
        </span>
        <span className="dc-market">{decision.market || "SOL-PERP"}</span>
        <span className="dc-leverage">
          {decision.consensus.leverage}×
        </span>
        <span className="dc-conf">{decision.consensus.confidence}% conf</span>
        <span className="dc-time">{timeAgo}</span>
        <ChevronDown className="dc-expand-icon" size={16} />
      </div>

      <div className="dc-agents">
        <AgentRow name="BULL" vote={decision.bullVote} />
        <AgentRow name="BEAR" vote={decision.bearVote} />
        <AgentRow name="ZEN" vote={decision.zenVote} />
      </div>

      <div className="dc-vote-breakdown">
        <span>Vote breakdown:</span>
        <VoteBreakdown
          bull={decision.bullVote.direction}
          bear={decision.bearVote.direction}
          zen={decision.zenVote.direction}
        />
        <strong className={`dc-vote-badge ${sameDirection === 3 ? "unanimous" : "majority"}`}>
          {sameDirection === 3 ? "UNANIMOUS" : `${sameDirection}/3 MAJORITY`}
        </strong>
      </div>

      {decision.solPriceVerified > 0 ? (
        <div
          className="dc-pyth-price"
          title="Price verified on-chain via Pyth oracle"
        >
          SOL at decision: ${(decision.solPriceVerified / 1e8).toFixed(2)}{" "}
          <span>Pyth verified ✓</span>
        </div>
      ) : (
        <div
          className="dc-pyth-price dc-pyth-unavailable"
          title="This decision was logged successfully, but no fresh Pyth price update account was attached to the decision transaction."
        >
          <span>Decision logged · Pyth snapshot not attached</span>
        </div>
      )}

      <div className={`dc-footer ${footerCls}`}>
        <span className={`dc-consensus ${cls}`}>
          CONSENSUS: {consensusStr}
          {decision.executed ? " → Executed" : " → Logged"}
        </span>
        {decision.executionRef && decision.executionRef.trim() && (
          <a
            className="dc-tx-link"
            href={`https://explorer.solana.com/tx/${decision.executionRef}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {decision.executionRef.slice(0, 4)}…
            {decision.executionRef.slice(-4)} <ExternalLink size={13} />
          </a>
        )}
      </div>

      {expanded && (
        <div className="dc-proof">
          <div className="dc-proof-head">
            <span>
              <ShieldCheck size={15} />
              ON-CHAIN PROOF
            </span>
            <a
              href={`https://explorer.solana.com/account/${decision.pubkey.toBase58()}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Verify on-chain <ExternalLink size={13} />
            </a>
          </div>
          <div className="dc-proof-grid">
            <ProofLine label="PDA" value={decision.pubkey.toBase58()} />
            <ProofLine label="BULL decoded bytes" value={formatBytes(decision.bullVote.reasoningBytes)} />
            <ProofLine label="BULL string" value={decision.bullVote.reasoning || "No reasoning provided."} />
            <ProofLine label="BEAR decoded bytes" value={formatBytes(decision.bearVote.reasoningBytes)} />
            <ProofLine label="BEAR string" value={decision.bearVote.reasoning || "No reasoning provided."} />
            <ProofLine label="ZEN decoded bytes" value={formatBytes(decision.zenVote.reasoningBytes)} />
            <ProofLine label="ZEN string" value={decision.zenVote.reasoning || "No reasoning provided."} />
          </div>
        </div>
      )}
    </article>
  );
}

function VoteBreakdown({
  bull,
  bear,
  zen,
}: {
  bull: number;
  bear: number;
  zen: number;
}) {
  const directions = ["LONG", "SHORT", "FLAT"];
  const dirNums = [1, 2, 0];
  const votes = [bull, bear, zen];

  return (
    <div className="vote-breakdown">
      {directions.map((direction, index) => {
        const count = votes.filter((vote) => vote === dirNums[index]).length;
        if (count === 0) return null;

        return (
          <div key={direction} className="vote-bar-row">
            <span className="vote-label">{direction}</span>
            <div className="vote-bar-track">
              <div
                className={`vote-bar-fill ${direction.toLowerCase()}`}
                style={{ width: `${(count / 3) * 100}%` }}
              />
            </div>
            <span className="vote-count">{count}/3</span>
          </div>
        );
      })}
    </div>
  );
}

function ProofLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="dc-proof-line">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function formatBytes(bytes: number[]): string {
  return bytes
    .filter((byte) => byte !== 0)
    .slice(0, 48)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}
