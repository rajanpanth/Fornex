import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { decodeVault, VAULT_ADDRESS, VaultData } from "../lib/chain";

export function useVault() {
  const { connection } = useConnection();
  const [vault, setVault] = useState<VaultData | null>(null);

  const refresh = useCallback(async () => {
    try {
      const info = await connection.getAccountInfo(VAULT_ADDRESS);
      if (info) setVault(decodeVault(info.data as Buffer));
    } catch {
      /* silent */
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const nav = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0;
  const trades = vault?.tradeCount || 0;
  const winRate =
    vault && vault.tradeCount > 0
      ? Math.round((vault.winningTrades / vault.tradeCount) * 100)
      : 0;
  const winningTrades = vault?.winningTrades || 0;

  return { vault, nav, trades, winRate, winningTrades, refresh };
}
