import { ShieldCheck, ShieldAlert } from "lucide-react";
import { VaultData } from "../lib/chain";

export default function RiskStatusCard({
  vault,
}: {
  vault: VaultData | null;
}) {
  const paused = vault?.isTradingPaused ?? false;

  // Every row below is enforced on-chain in the Anchor program.
  const rows: Array<{ label: string; value: string }> = [
    { label: "Max leverage", value: "BULL 3× / BEAR 2× / ZEN 2×" },
    { label: "Confidence floor", value: "60% (executed only)" },
    { label: "NAV write cap", value: "±10% / cycle" },
    { label: "Cycle window", value: "15 min" },
    { label: "Custody", value: "User-controlled" },
  ];

  return (
    <div className={`risk-card ${paused ? "is-paused" : "is-active"}`}>
      <div className="risk-card__head">
        <span className="risk-card__title">
          {paused ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
          RISK STATUS
        </span>
        <span
          className={`risk-card__pill ${paused ? "is-paused" : "is-active"}`}
        >
          <span className="live-dot" aria-hidden="true" />
          {paused ? "Paused" : "Normal"}
        </span>
      </div>
      <ul className="risk-card__rows">
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </li>
        ))}
      </ul>
      <p className="risk-card__foot">
        Every cap is enforced in the Anchor program. The agent cannot override them.
      </p>
    </div>
  );
}
