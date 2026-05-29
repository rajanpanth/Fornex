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
    { label: "Leverage", value: "3x / 2x / 2x" },
    { label: "Min conf", value: "60%" },
    { label: "NAV cap", value: "+/-10%" },
    { label: "Cycle", value: "15m" },
    { label: "Custody", value: "User" },
  ];

  return (
    <div className={`risk-card ${paused ? "is-paused" : "is-active"}`}>
      <div className="risk-card__head">
        <span className="risk-card__title">
          {paused ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
          Risk
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
        Anchor-enforced limits.
      </p>
    </div>
  );
}
