import { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import {
  DECISION_ACCOUNT_SIZE,
  Decision,
  LEGACY_DECISION_ACCOUNT_SIZE,
  RPC_URL,
  decodeDecision,
  PROGRAM_ID,
} from "../lib/chain";
import { useDecisionStream } from "./useDecisionStream";

type ApiDecision = Omit<Decision, "pubkey"> & { pubkey: string };

function hydrateDecision(decision: ApiDecision): Decision {
  return {
    ...decision,
    pubkey: new PublicKey(decision.pubkey),
  };
}

export function useDecisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/decisions", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { decisions?: ApiDecision[] };
        const parsed = (data.decisions || []).map(hydrateDecision);
        console.log("[fornex] api decisions:", parsed.length);
        setDecisions(parsed);
        return;
      }
      console.error("[fornex] /api/decisions failed:", response.status);
    } catch (e) {
      console.error("[fornex] /api/decisions fetch failed:", e);
    }

    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const currentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: DECISION_ACCOUNT_SIZE }],
      });
      const legacyAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: LEGACY_DECISION_ACCOUNT_SIZE }],
      });
      const accounts = [...currentAccounts, ...legacyAccounts];
      console.log("[fornex] raw accounts:", accounts.length);
      const parsed = accounts
        .map((a) => decodeDecision(a.pubkey, a.account.data as Buffer))
        .filter(Boolean)
        .sort((a, b) => b!.decisionIndex - a!.decisionIndex)
        .slice(0, 12) as Decision[];
      console.log("[fornex] parsed decisions:", parsed.length);
      setDecisions(parsed);
    } catch (e) {
      console.error("[fornex] useDecisions fetch failed:", e);
      /* silent */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Live push: any matching program log triggers an immediate refresh.
  // The polling above stays as a backstop in case the WSS subscription
  // is unavailable (rate-limit, browser policy, etc).
  useDecisionStream(() => {
    void refresh();
  });

  return { decisions, refresh };
}
