import { Connection } from "@solana/web3.js";
import { useEffect, useState } from "react";

export type PriorityLevel = "DYNAMIC" | "FAST" | "TURBO";

const PRIORITY_FEE_LAMPORTS: Record<PriorityLevel, number | null> = {
  DYNAMIC: null,
  FAST: 10_000,
  TURBO: 100_000,
};

export function usePriorityFee() {
  const [level, setLevel] = useState<PriorityLevel>("DYNAMIC");
  const [dynamicFee, setDynamicFee] = useState(5000);

  useEffect(() => {
    async function fetchDynamic() {
      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"
        );
        const fees = await connection.getRecentPrioritizationFees();
        if (fees.length > 0) {
          const avg =
            fees
              .slice(0, 10)
              .reduce((sum, fee) => sum + fee.prioritizationFee, 0) /
            Math.min(fees.length, 10);
          setDynamicFee(Math.ceil(avg));
        }
      } catch {
        /* keep previous fee */
      }
    }

    void fetchDynamic();
    const interval = window.setInterval(fetchDynamic, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const currentFee =
    level === "DYNAMIC" ? dynamicFee : PRIORITY_FEE_LAMPORTS[level]!;

  return { level, setLevel, currentFee };
}
