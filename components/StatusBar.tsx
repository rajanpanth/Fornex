import { Dispatch, SetStateAction, useEffect, useState } from "react";
import type { PriorityLevel } from "../hooks/usePriorityFee";

const PYTH_SOL_FEED =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

export default function StatusBar({
  level,
  setLevel,
}: {
  /**
   * Priority-level + setter are still accepted so existing call-sites
   * compile, but rendering the picker has moved to `DepositPanel`. The
   * navbar pill becomes silent presence-only metadata: Pyth health and
   * the current cluster.
   */
  level?: PriorityLevel;
  setLevel?: Dispatch<SetStateAction<PriorityLevel>>;
}) {
  // Suppress unused-arg lint without breaking the existing call signature.
  void level;
  void setLevel;

  const [pythUp, setPythUp] = useState(true);

  useEffect(() => {
    async function pingPyth() {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/api/latest_vaas?ids[]=${PYTH_SOL_FEED}`
        );
        setPythUp(res.ok);
      } catch {
        setPythUp(false);
      }
    }

    void pingPyth();
    const interval = window.setInterval(pingPyth, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <div className="status-pill">
        <span className={`dot ${pythUp ? "green" : "red"}`}>●</span>
        Pyth {pythUp ? "UP" : "DOWN"}
      </div>

      <div className="status-pill">
        <span className="dot yellow">●</span>
        Devnet
      </div>
    </>
  );
}
