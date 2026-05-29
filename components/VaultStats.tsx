import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Activity, BarChart3, CircleDollarSign, Percent, Wallet } from "lucide-react";
import { VaultData } from "../lib/chain";

const FNRX_MINT_ADDRESS = "BNBf6ed4h8dZiVd8wpUkcv8BUyFsp75eidkcUhSb94vj";

export default function VaultStats({
  vault,
  nav,
  trades,
  executedTrades,
  winRate,
  inceptionNavSol,
  userSharesSol,
  userPnlPct,
  userDeposit,
  fnrxBalance,
}: {
  vault: VaultData | null;
  nav: number;
  trades: number;
  executedTrades: number;
  winRate: number | null;
  inceptionNavSol: number;
  userSharesSol: number;
  userPnlPct: number | null;
  userDeposit: { shares: bigint; totalDeposited: bigint } | null;
  fnrxBalance: number | null;
}) {
  const pnlSol =
    userDeposit && userPnlPct !== null
      ? userSharesSol - Number(userDeposit.totalDeposited) / LAMPORTS_PER_SOL
      : 0;

  // Since-inception change uses the on-chain inception_nav stamped on the
  // first deposit. No hardcoded baseline. Renders nothing when unavailable.
  const navChangePct: number | null =
    inceptionNavSol > 0 ? ((nav - inceptionNavSol) / inceptionNavSol) * 100 : null;

  return (
    <div className="vault-stats-panel">
      <div className="panel-title-row">
        <span>Vault</span>
        <strong>{vault?.isTradingPaused ? "Paused" : "Active"}</strong>
      </div>
      <div className="vault-stats-grid">
        <div className="vault-stat-box">
          <CircleDollarSign size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">NAV</div>
          <div className="vault-stat-value">{nav.toFixed(3)} SOL</div>
          {navChangePct === null ? (
            <div className="vault-stat-sub neutral">since inception</div>
          ) : (
            <div className={`vault-stat-sub ${navChangePct >= 0 ? "up" : "down"}`}>
              {navChangePct >= 0 ? "+" : ""}
              {navChangePct.toFixed(1)}% inception
            </div>
          )}
        </div>

        <div className="vault-stat-box">
          <Activity size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">P&L</div>
          <div className="vault-stat-value">
            {userPnlPct !== null
              ? `${userPnlPct >= 0 ? "+" : ""}${userPnlPct.toFixed(2)}%`
              : "-"}
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
            $FNRX
          </div>
          <div className="vault-stat-value">
            {fnrxBalance !== null ? fnrxBalance.toFixed(4) : "-"}
          </div>
          <div className="vault-stat-sub neutral">
            {fnrxBalance !== null ? "Share token" : "Connect wallet"}
          </div>
          <a
            href={`https://explorer.solana.com/address/${FNRX_MINT_ADDRESS}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mint-link"
          >
            Explorer ↗
          </a>
        </div>

        <div className="vault-stat-box">
          <Percent size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Win</div>
          <div className="vault-stat-value">
            {winRate === null ? "-" : `${winRate}%`}
          </div>
          <div className="vault-stat-sub neutral">
            {executedTrades} {executedTrades === 1 ? "trade" : "trades"}
          </div>
        </div>

        <div className="vault-stat-box">
          <BarChart3 size={17} className="vault-stat-icon" />
          <div className="vault-stat-label">Decisions</div>
          <div className="vault-stat-value">{trades}</div>
          <div className="vault-stat-sub neutral">On-chain</div>
        </div>
      </div>
    </div>
  );
}
