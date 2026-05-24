import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TrendingUp } from "lucide-react";
import { VaultData } from "../lib/chain";

export default function EquityCurve({ vault }: { vault: VaultData | null }) {
  const [range, setRange] = useState<"24h" | "all">("24h");

  const chartData = useMemo(() => {
    const base = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 10;
    const points = range === "24h" ? 24 : 36;
    const now = Date.now();
    return Array.from({ length: points }, (_, i) => {
      const ts = new Date(
        now - (points - i) * (range === "24h" ? 3600_000 : 7200_000)
      );
      const hh = ts.getHours().toString().padStart(2, "0");
      const mm = ts.getMinutes().toString().padStart(2, "0");
      return {
        t: `${hh}:${mm}`,
        nav: Number((base * (0.98 + i / (points * 35))).toFixed(4)),
      };
    });
  }, [range, vault]);

  return (
    <div className="equity-panel">
      <div className="equity-header">
        <span className="equity-title">
          <TrendingUp size={16} />
          VAULT NAV
        </span>
        <div className="equity-toggle">
          <button
            className={`equity-toggle-btn${range === "24h" ? " active" : ""}`}
            onClick={() => setRange("24h")}
          >
            24H
          </button>
          <button
            className={`equity-toggle-btn${range === "all" ? " active" : ""}`}
            onClick={() => setRange("all")}
          >
            ALL
          </button>
        </div>
      </div>

      <div className="equity-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="navGradApp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dbff6c" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#dbff6c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              orientation="right"
              stroke="transparent"
              tick={{
                fill: "#334155",
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
              }}
              tickLine={false}
              axisLine={false}
              width={54}
              tickCount={3}
            />
            <Tooltip
              contentStyle={{
                background: "#0d1625",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "6px",
                fontSize: "11px",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#e2e8f0",
              }}
              cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              formatter={(v: number) => [`${v} SOL`, "NAV"]}
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke="#dbff6c"
              strokeWidth={1.5}
              fill="url(#navGradApp)"
              dot={false}
              activeDot={{ r: 3, fill: "#dbff6c", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
