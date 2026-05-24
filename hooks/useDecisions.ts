import { useConnection } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  decodeDecision,
  PROGRAM_ID,
} from "../lib/chain";

export function useDecisions() {
  const { connection } = useConnection();
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const refresh = useCallback(async () => {
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            dataSize: DECISION_ACCOUNT_SIZE,
          },
        ],
      });
      const parsed = accounts
        .map((a) => decodeDecision(a.pubkey, a.account.data as Buffer))
        .filter(Boolean)
        .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
        .slice(0, 12) as Decision[];
      setDecisions(parsed);
    } catch {
      /* silent */
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { decisions, refresh };
}
