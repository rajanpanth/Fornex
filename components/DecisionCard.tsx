import { useState } from "react";
import { Bot, ChevronDown, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { Decision, dirLabel, formatTimeAgo } from "../lib/chain";

/**
 * Brain prompt-set version. Bump this whenever `agent/src/brain.ts`
 * `PROMPTS_BY_MODE` is edited so judges and depositors can correlate a
 * decision to a specific prompt iteration. Strategy mode is captured
 * separately via the on-chain `VaultStrategy` PDA.
 */
const PROMPT_VERSION = "v0.4-mode-aware";

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
  const outcomeCls = decision.executed ? "executed" : "logged";

  return (
    <article className={`decision-card ${cls} ${outcomeCls}${expanded ? " expanded" : ""}`}>
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

      <div className={`dc-footer ${footerCls} ${outcomeCls}`}>
        <span className={`dc-consensus ${cls} ${outcomeCls}`}>
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
        {decision.executed && process.env.NEXT_PUBLIC_AGENT_PUBKEY && (
          <a
            className="dc-tx-link"
            href={`https://app.drift.trade/?authority=${process.env.NEXT_PUBLIC_AGENT_PUBKEY}&network=devnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Drift ↗
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

          <ProofChips
            pdaB58={decision.pubkey.toBase58()}
            promptVersion={PROMPT_VERSION}
            executionRef={decision.executionRef}
          />

          <ReasoningTraceBlock
            persona="BULL"
            tone="bull"
            vote={decision.bullVote}
          />
          <ReasoningTraceBlock
            persona="BEAR"
            tone="bear"
            vote={decision.bearVote}
          />
          <ReasoningTraceBlock
            persona="ZEN"
            tone="zen"
            vote={decision.zenVote}
          />

          <ConsensusReceipt
            consensus={decision.consensus}
            executed={decision.executed}
            executionRef={decision.executionRef}
            solPriceVerified={decision.solPriceVerified}
            priceConfidence={decision.priceConfidence}
            timestamp={decision.timestamp}
          />
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

function ProofChips({
  pdaB58,
  promptVersion,
  executionRef,
}: {
  pdaB58: string;
  promptVersion: string;
  executionRef: string;
}) {
  return (
    <div className="dc-proof-chips" role="list">
      <ProofChip label="PDA" value={pdaB58} short copyable />
      <ProofChip label="Prompts" value={promptVersion} />
      {executionRef && executionRef.trim() && (
        <ProofChip
          label="Tx"
          value={executionRef}
          href={`https://explorer.solana.com/tx/${executionRef}?cluster=devnet`}
          short
        />
      )}
    </div>
  );
}

function ProofChip({
  label,
  value,
  short,
  copyable,
  href,
}: {
  label: string;
  value: string;
  short?: boolean;
  copyable?: boolean;
  href?: string;
}) {
  const display = short && value.length > 14 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
  const onCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
  };
  const inner = (
    <>
      <span className="dc-chip-label">{label}</span>
      <code>{display}</code>
      {copyable && (
        <button
          type="button"
          className="dc-chip-copy"
          aria-label={`Copy ${label}`}
          onClick={onCopy}
        >
          <Copy size={11} />
        </button>
      )}
      {href && <ExternalLink size={11} className="dc-chip-link" />}
    </>
  );
  return href ? (
    <a
      role="listitem"
      className="dc-proof-chip dc-proof-chip--link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  ) : (
    <div role="listitem" className="dc-proof-chip">
      {inner}
    </div>
  );
}

function ReasoningTraceBlock({
  persona,
  tone,
  vote,
}: {
  persona: string;
  tone: "bull" | "bear" | "zen";
  vote: {
    direction: number;
    leverage: number;
    confidence: number;
    reasoning: string;
    reasoningBytes: number[];
  };
}) {
  const dir = dirLabel(vote.direction);
  const dirCls = dir.toLowerCase();
  const meaningful = vote.reasoningBytes.filter((b) => b !== 0).length;
  const fnv = fnv1a32(vote.reasoningBytes);
  const fullReasoning = vote.reasoning || "No reasoning provided.";

  const onCopyReasoning = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(fullReasoning);
    }
  };

  return (
    <div className={`dc-trace dc-trace--${tone}`}>
      <header className="dc-trace__head">
        <span className="dc-trace__persona">{persona}</span>
        <span className={`dc-trace__dir is-${dirCls}`}>{dir}</span>
        <span className="dc-trace__lev">{vote.leverage}×</span>
        <span className="dc-trace__conf">{vote.confidence}%</span>
        <span className="dc-trace__hash" title="FNV-1a 32 over the on-chain reasoning bytes">
          fnv:{fnv}
        </span>
        <button
          type="button"
          className="dc-trace__copy"
          onClick={onCopyReasoning}
          aria-label={`Copy ${persona} reasoning`}
        >
          <Copy size={11} /> copy
        </button>
      </header>
      <p className="dc-trace__reasoning">&ldquo;{fullReasoning}&rdquo;</p>
      <details className="dc-trace__bytes">
        <summary>
          On-chain reasoning bytes ({meaningful} of 200 used)
        </summary>
        <code>{formatBytesFull(vote.reasoningBytes)}</code>
      </details>
    </div>
  );
}

function ConsensusReceipt({
  consensus,
  executed,
  executionRef,
  solPriceVerified,
  priceConfidence,
  timestamp,
}: {
  consensus: {
    direction: number;
    leverage: number;
    confidence: number;
    reasoning: string;
  };
  executed: boolean;
  executionRef: string;
  solPriceVerified: number;
  priceConfidence: number;
  timestamp: number;
}) {
  const dir = dirLabel(consensus.direction);
  const dirCls = dir.toLowerCase();
  const ts = new Date(timestamp * 1000);
  const tsLabel = isNaN(ts.getTime()) ? "-" : ts.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const priceLabel = solPriceVerified > 0 ? `$${(solPriceVerified / 1e8).toFixed(2)}` : "-";
  const confidenceLabel = priceConfidence > 0 ? `±$${(priceConfidence / 1e8).toFixed(2)}` : "-";

  return (
    <div className="dc-receipt">
      <header className="dc-receipt__head">
        <span>CONSENSUS RECEIPT</span>
        <span className={`dc-receipt__dir is-${dirCls}`}>{dir}</span>
        <span className="dc-receipt__lev">{consensus.leverage}×</span>
        <span className="dc-receipt__conf">{consensus.confidence}%</span>
        <span className={`dc-receipt__exec ${executed ? "ok" : "skip"}`}>
          {executed ? "EXECUTED" : "LOGGED ONLY"}
        </span>
      </header>
      <dl className="dc-receipt__grid">
        <div>
          <dt>Pyth SOL price</dt>
          <dd>
            {priceLabel}{" "}
            <span className="dc-receipt__sub">{confidenceLabel}</span>
          </dd>
        </div>
        <div>
          <dt>On-chain timestamp</dt>
          <dd>{tsLabel}</dd>
        </div>
        <div>
          <dt>Execution ref</dt>
          <dd>
            {executionRef && executionRef.trim() ? (
              <code>{`${executionRef.slice(0, 8)}…${executionRef.slice(-8)}`}</code>
            ) : (
              <span className="dc-receipt__sub">none</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function formatBytesFull(bytes: number[]): string {
  return bytes
    .filter((byte) => byte !== 0)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

/**
 * Compact tamper-evidence hash of the reasoning bytes. We use FNV-1a 32-bit
 * because it's deterministic, no async crypto API, and renders to a short
 * 8-hex-char string. The actual on-chain bytes can still be byte-compared
 * via the "decoded bytes" expanders; the hash is a quick visual diff signal.
 */
function fnv1a32(bytes: number[]): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte & 0xff;
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
