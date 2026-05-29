import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Gauge, LockKeyhole } from "lucide-react";
import type { PriorityLevel } from "../hooks/usePriorityFee";

export default function DepositPanel({
  walletConnected,
  loading,
  onSubmit,
  nav,
  userSharesRaw,
  priorityFee,
  setPriorityFee,
  currentFee,
}: {
  walletConnected: boolean;
  loading: boolean;
  onSubmit: (kind: "deposit" | "withdraw", amount: string) => void;
  nav: number;
  userSharesRaw: bigint;
  priorityFee: PriorityLevel;
  setPriorityFee: (level: PriorityLevel) => void;
  currentFee: number;
}) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0.1");
  const numericAmount = Number(amount) || 0;

  const inputLabel = tab === "deposit" ? "Deposit amount" : "Shares to withdraw";
  const inputUnit = tab === "deposit" ? "SOL" : "SHARES";
  const previewLabel =
    tab === "deposit" ? "Estimated vault shares" : "Estimated SOL returned";
  const previewValue =
    tab === "deposit"
      ? `${numericAmount.toFixed(4)} shares`
      : `${(numericAmount * (nav || 1)).toFixed(4)} SOL`;
  const maxValue =
    tab === "deposit" ? "0.1" : formatUnits(userSharesRaw, 9);

  // Levels in display order. Match the keys exactly with `PriorityLevel`.
  const FEE_LEVELS: Array<{
    key: PriorityLevel;
    label: string;
    sub: string;
  }> = [
    { key: "DYNAMIC", label: "Dynamic", sub: "live RPC avg" },
    { key: "FAST", label: "Fast", sub: "10k μλ" },
    { key: "TURBO", label: "Turbo", sub: "100k μλ" },
  ];

  return (
    <div className="deposit-panel">
      <div className="trade-ticket-header">
        <div>
          <span>Vault ticket</span>
          <strong>{tab === "deposit" ? "Deposit SOL" : "Withdraw shares"}</strong>
        </div>
        <LockKeyhole size={18} />
      </div>
      <div className="dw-tabs">
        <button
          className={`dw-tab${tab === "deposit" ? " active" : ""}`}
          onClick={() => setTab("deposit")}
        >
          <ArrowDownToLine size={15} />
          Deposit
        </button>
        <button
          className={`dw-tab${tab === "withdraw" ? " active" : ""}`}
          onClick={() => setTab("withdraw")}
        >
          <ArrowUpFromLine size={15} />
          Withdraw
        </button>
      </div>

      <div className="dw-body">
        <div>
          <div className="dw-input-label">{inputLabel}</div>
          <div className="dw-input-wrap">
            <input
              className="dw-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
            <span className="dw-input-suffix">{inputUnit}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <button className="dw-max-btn" onClick={() => setAmount(maxValue)}>
              MAX
            </button>
          </div>
        </div>

        <div className="dw-preview">
          <span>{previewLabel}</span>
          <strong>{previewValue}</strong>
        </div>

        {/* Priority fee picker — segmented control inline with the
            ticket so the user sees both the picked level *and* the
            resolved μ-lamports value before signing. */}
        <div className="dw-fee">
          <div className="dw-fee__head">
            <span className="dw-fee__label">
              <Gauge size={12} /> Priority fee
            </span>
            <span className="dw-fee__value" title="Compute-unit price for the next tx">
              {currentFee.toLocaleString()} <em>μλ / CU</em>
            </span>
          </div>
          <div className="dw-fee__seg" role="radiogroup" aria-label="Priority fee level">
            {FEE_LEVELS.map((opt) => {
              const active = priorityFee === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`dw-fee__opt ${active ? "is-active" : ""}`}
                  onClick={() => setPriorityFee(opt.key)}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!walletConnected ? (
          <button className="dw-submit ghost" disabled>
            Connect Wallet First
          </button>
        ) : loading ? (
          <button className="dw-submit primary" disabled>
            <span className="spinner" />
            Confirming…
          </button>
        ) : (
          <button
            className="dw-submit primary"
            onClick={() => onSubmit(tab, amount)}
          >
            {tab === "deposit" ? "Deposit SOL" : "Withdraw SOL"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const raw = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0");
  const trimmed = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${
    trimmed ? `.${trimmed}` : ""
  }`;
}
