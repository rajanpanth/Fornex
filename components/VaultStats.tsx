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
  fnrxBalance,
}: {
  vault: VaultData | null;
  nav: number;
  trades: number;
  winRate: number;
  userSharesSol: number;
  userPnlPct: number | null;
  userDeposit: { shares: bigint; totalDeposited: bigint } | null;
  fnrxBalance: number | null;
}) {
  const pnlSol =
    userDeposit && userPnlPct !== null
      ? userSharesSol - Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL
      : 0;
  const navChangePct = ((nav - 10) / 10) * 100;

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
          <div className={`vault-stat-sub ${navChangePct >= 0 ? "up" : "down"}`}>
            {navChangePct >= 0 ? "+" : ""}
            {navChangePct.toFixed(1)}%
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
          <div className="vault-stat-label" title="$FNRX is your vault share token. Hold it in Phantom. Redeem anytime for SOL.">
            $FNRX Balance
          </div>
          <div className="vault-stat-value">
            {fnrxBalance !== null ? `${fnrxBalance.toFixed(4)} FNRX` : "—"}
          </div>
          <div className="vault-stat-sub neutral">
            {fnrxBalance !== null ? `≈ ${userSharesSol.toFixed(3)} SOL current value` : "Connect wallet"}
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
