import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TrendingUp } from "lucide-react";
import {
  decodeNavRecord,
  PROGRAM_ID,
  RPC_URL,
  VAULT_ADDRESS,
  VaultData,
} from "../lib/chain";

type Range = "24h" | "1w" | "1m" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "24h": "24H",
  "1w":  "1 Week",
  "1m":  "1 Month",
  "all": "All",
};

const RANGE_POINTS: Record<Range, number> = {
  "24h": 24,
  "1w":  28,
  "1m":  30,
  "all": 36,
};

const RANGE_INTERVAL: Record<Range, number> = {
  "24h": 3_600_000,       // 1 h
  "1w":  6 * 3_600_000,   // 6 h
  "1m":  24 * 3_600_000,  // 1 day
  "all": 48 * 3_600_000,  // 2 days
};

type ChartPoint = {
  t: string;
  nav: number;
  tradeCount?: number;
};

const NAV_RECORD_SIZE = 8 + 32 + 8 + 8 + 8 + 8 + 1;
function buildDemoPoints(base: number, points: number, intervalMs: number): ChartPoint[] {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const ts = new Date(now - (points - 1 - i) * intervalMs);
    const hh = ts.getHours().toString().padStart(2, "0");
    const mm = ts.getMinutes().toString().padStart(2, "0");
    const factor = 1 - 0.03 + 0.005 * i + 0.055 * Math.sin(i * 0.55);
    return { t: `${hh}:${mm}`, nav: Number((base * factor).toFixed(4)) };
  });
}

export default function EquityCurve({ vault }: { vault: VaultData | null }) {
  const [range, setRange] = useState<Range>("24h");
  const [dropOpen, setDropOpen] = useState(false);
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchNavHistory() {
      const connection = new Connection(RPC_URL, "confirmed");
      const records = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: NAV_RECORD_SIZE },
          { memcmp: { offset: 8, bytes: VAULT_ADDRESS.toBase58() } },
        ],
      });

      const decoded = records
        .map((record) => decodeNavRecord(record.pubkey, record.account.data))
        .filter((record): record is NonNullable<typeof record> => Boolean(record))
        .sort((a, b) => Number(a.recordIndex - b.recordIndex))
        .map((record) => ({
          t: new Date(record.timestamp * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          nav: Number(record.nav) / LAMPORTS_PER_SOL,
          tradeCount: Number(record.tradeCount),
        }));

      if (!cancelled) setHistory(decoded);
    }

    // Stagger initial fetch by 2s to avoid hitting 429s alongside useDecisions/useVault
    const initialDelay = window.setTimeout(() => {
      fetchNavHistory().catch(() => {
        if (!cancelled) setHistory([]);
      });
    }, 2_000);

    const interval = window.setInterval(
      () => fetchNavHistory().catch(() => undefined),
      30_000
    );
    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
      window.clearInterval(interval);
    };
  }, []);

  const isDemo = history.length === 0;

  const chartData = useMemo(() => {
    const visibleHistory = range === "24h" ? history.slice(-24) : history;
    if (visibleHistory.length > 0) return visibleHistory;

    const rawNav = vault ? Number(vault.nav) / LAMPORTS_PER_SOL : 0;
    const base = rawNav > 0.01 ? rawNav : 10;
    return buildDemoPoints(base, RANGE_POINTS[range], RANGE_INTERVAL[range]);
  }, [range, vault, history]);

  // Dynamic Y-axis domain with padding so the line never sits at the edge
  const { yMin, yMax } = useMemo(() => {
    const vals = chartData.map((d) => d.nav);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.18 || lo * 0.04 || 0.2;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [chartData]);

  // ~5 evenly-spaced X-axis labels
  const xTicks = useMemo(() => {
    const step = Math.ceil(chartData.length / 5);
    return chartData.filter((_, i) => i % step === 0).map((d) => d.t);
  }, [chartData]);

  const isTrending = chartData.length > 1 && chartData[chartData.length - 1].nav >= chartData[0].nav;
  const strokeColor = isTrending ? "#dbff6c" : "#ff6b8a";
  const gradientId = isTrending ? "navGradUp" : "navGradDown";

  return (
    <div className="equity-panel">
      <div className="equity-header">
        <span className="equity-title">
          <TrendingUp size={14} />
          PERFORMANCE HISTORY
        </span>
        {isDemo && <span className="equity-demo-badge">DEMO</span>}
        <div className="equity-range-picker" ref={dropRef}>
          <button
            className="equity-range-btn"
            onClick={() => setDropOpen((o) => !o)}
            aria-expanded={dropOpen}
            aria-haspopup="listbox"
          >
            {RANGE_LABELS[range]}
            <svg width="9" height="5" viewBox="0 0 9 5" fill="none">
              <path d="M1 1l3.5 3L8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {dropOpen && (
            <div className="equity-range-drop" role="listbox">
              {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                <button
                  key={r}
                  role="option"
                  aria-selected={range === r}
                  className={`equity-range-opt${range === r ? " active" : ""}`}
                  onClick={() => { setRange(r); setDropOpen(false); }}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="equity-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="navGradUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#dbff6c" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#dbff6c" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="navGradDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#ff6b8a" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#ff6b8a" stopOpacity={0}    />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="t"
              ticks={xTicks}
              tick={{ fill: "#3d526a", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={false}
              height={16}
            />
            <YAxis
              orientation="right"
              stroke="transparent"
              tick={{ fill: "#5e738a", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickCount={4}
              domain={[yMin, yMax]}
              tickFormatter={(v: number) =>
                v >= 1 ? v.toFixed(1) : v.toFixed(3)
              }
            />
            <Tooltip
              contentStyle={{
                background: "#090f1c",
                border: `1px solid ${isTrending ? "rgba(219,255,108,0.22)" : "rgba(255,107,138,0.22)"}`,
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "11px",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#e2e8f0",
                boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
              }}
              labelStyle={{ color: "#5e738a", marginBottom: "4px", display: "block" }}
              cursor={{
                stroke: isTrending ? "rgba(219,255,108,0.18)" : "rgba(255,107,138,0.18)",
                strokeWidth: 1,
                strokeDasharray: "4 3",
              }}
              formatter={(v: number) => [
                <span key="v" style={{ color: strokeColor, fontWeight: 700 }}>
                  {v.toFixed(4)} SOL
                </span>,
                "NAV",
              ]}
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: strokeColor,
                stroke: isTrending ? "rgba(219,255,108,0.3)" : "rgba(255,107,138,0.3)",
                strokeWidth: 5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

