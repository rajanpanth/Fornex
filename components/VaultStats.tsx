import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Activity, CircleDollarSign, Percent, Wallet } from "lucide-react";
import { VaultData } from "../lib/chain";

export default function VaultStats({
  vault,
  nav,
  trades,
  winRate,
  userSharesSol,
  userPnlPct,
  userDeposit,
}: {
  vault: VaultData | null;
  nav: number;
  trades: number;
  winRate: number;
  userSharesSol: number;
  userPnlPct: number | null;
  userDeposit: { shares: bigint; totalDeposited: bigint } | null;
}) {
  const pnlSol =
    userDeposit && userPnlPct !== null
      ? userSharesSol - Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL
      : 0;

  return (
    <div className="vault-stats-panel">
      <div className="panel-title-row">
        <span>Vault overview</span>
        <strong>{vault?.isTradingPaused ? "Paused" : "Active"}</strong>
      </div>
      <div className="vault-stats-grid">
        <div className="vault-stat-box">
          <CircleDollarSign size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Vault NAV</div>
          <div className="vault-stat-value">{nav.toFixed(3)} SOL</div>
          <div className="vault-stat-sub up">
            +{((nav - 10) / 10 * 100).toFixed(1)}%
          </div>
        </div>

        <div className="vault-stat-box">
          <Activity size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Your P&L</div>
          <div className="vault-stat-value">
            {userPnlPct !== null
              ? `${userPnlPct >= 0 ? "+" : ""}${userPnlPct.toFixed(2)}%`
              : "—"}
          </div>
          <div
            className={`vault-stat-sub ${
              userPnlPct !== null
                ? userPnlPct >= 0
                  ? "up"
                  : "down"
                : "neutral"
            }`}
          >
            {userPnlPct !== null
              ? `${pnlSol >= 0 ? "+" : ""}${pnlSol.toFixed(4)} SOL`
              : "Connect wallet"}
          </div>
        </div>

        <div className="vault-stat-box">
          <Wallet size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Your Shares</div>
          <div className="vault-stat-value">
            {userDeposit
              ? (Number(userDeposit.shares) / LAMPORTS_PER_SOL).toFixed(4)
              : "—"}
          </div>
          <div className="vault-stat-sub neutral">
            {userDeposit ? `≈ ${userSharesSol.toFixed(3)} SOL` : "No deposit"}
          </div>
        </div>

        <div className="vault-stat-box">
          <Percent size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Win Rate</div>
          <div className="vault-stat-value">{winRate}%</div>
          <div className="vault-stat-sub neutral">{trades} trades</div>
        </div>
      </div>
    </div>
  );
}
