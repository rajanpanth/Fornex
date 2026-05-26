import { useConnection } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  decodeDecision,
  PROGRAM_ID,
} from "../lib/chain";

export function useDecisions() {
  const { connection } = useConnection();
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const refresh = useCallback(async () => {
    try {
      // Run sequentially to avoid concurrent getProgramAccounts 429s on public devnet
      const currentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
      });
      const legacyAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
      });
      const accounts = [...currentAccounts, ...legacyAccounts];
      console.log('[fornex] raw accounts:', accounts.length);
      const parsed = accounts
        .map((a) => decodeDecision(a.pubkey, a.account.data as Buffer))
        .filter(Boolean)
        .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
        .slice(0, 12) as Decision[];
      console.log('[fornex] parsed decisions:', parsed.length);
      setDecisions(parsed);
    } catch (e) {
      console.error('[fornex] useDecisions fetch failed:', e);
      /* silent */
    }
  }, [connection]);

  // Primary poll – fires immediately on mount
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { decisions, refresh };
}

