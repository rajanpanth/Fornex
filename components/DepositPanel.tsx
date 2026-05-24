import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole } from "lucide-react";

export default function DepositPanel({
  walletConnected,
  loading,
  onSubmit,
  nav,
}: {
  walletConnected: boolean;
  loading: boolean;
  onSubmit: (kind: "deposit" | "withdraw", amount: string) => void;
  nav: number;
}) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("0.1");

  const preview =
    tab === "deposit"
      ? `You will receive: ${amount || "0"} shares`
      : `You will receive: ${(Number(amount) * (nav || 1)).toFixed(4)} SOL`;

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
          <div className="dw-input-label">Amount (SOL)</div>
          <div className="dw-input-wrap">
            <input
              className="dw-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
            <span className="dw-input-suffix">SOL</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <button className="dw-max-btn" onClick={() => setAmount("1.0")}>
              MAX
            </button>
          </div>
        </div>

        <div className="dw-preview">
          <span>Estimated output</span>
          <strong>{preview.replace("You will receive: ", "")}</strong>
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
