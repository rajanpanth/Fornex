import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { decodeVault, RPC_URL, VAULT_ADDRESS, VaultData } from "../lib/chain";

export function useVault() {
  const [vault, setVault] = useState<VaultData | null>(null);

  const refresh = useCallback(async () => {
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const info = await connection.getAccountInfo(VAULT_ADDRESS);
      if (info) {
        setVault(decodeVault(info.data as Buffer));
      }
    } catch (e) {
      console.error('[fornex] useVault fetch failed:', e);
      /* silent */
    }
  }, []);

  // Primary poll – fires immediately on mount
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const nav = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0;
  const trades = vault?.tradeCount || 0;
  const executedTrades = vault?.executedTradeCount || 0;
  const winningTrades = vault?.winningTrades || 0;
  // Win rate is derived from executed trades only - deposits no longer count
  // as wins. Returns null when no executed trades exist so the UI renders "-".
  const winRate: number | null =
    executedTrades > 0 ? Math.round((winningTrades / executedTrades) * 100) : null;
  const inceptionNavSol = vault ? Number(vault.inceptionNav) / LAMPORTS_PER_SOL : 0;

  return {
    vault,
    nav,
    trades,
    executedTrades,
    winRate,
    winningTrades,
    inceptionNavSol,
    refresh,
  };
}
