import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { Decision, dirLabel } from "../lib/chain";

export default function AgentPerformanceChart({
  decisions,
}: {
  decisions: Decision[];
}) {
  const data = useMemo(
    () =>
      decisions
        .slice(0, 10)
        .reverse()
        .map((decision) => ({
          name: `#${decision.decisionIndex}`,
          confidence: decision.consensus.confidence,
          direction: dirLabel(decision.consensus.direction),
          executed: decision.executed,
          bull: dirLabel(decision.bullVote.direction),
          bear: dirLabel(decision.bearVote.direction),
          zen: dirLabel(decision.zenVote.direction),
        })),
    [decisions]
  );

  return (
    <div className="performance-panel">
      <div className="performance-header">
        <span className="performance-title">
          <Activity size={16} />
          AGENT PERFORMANCE
        </span>
      </div>
      <div className="performance-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#5e738a", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload;
                return (
                  <div className="performance-tooltip">
                    <strong>{row.name} {row.direction}</strong>
                    <span>Confidence: {row.confidence}%</span>
                    <span>BULL {row.bull} / BEAR {row.bear} / ZEN {row.zen}</span>
                    <span>{row.executed ? "Executed" : "Logged only"}</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.direction === "LONG"
                      ? "#00e5a0"
                      : entry.direction === "SHORT"
                      ? "#ff3358"
                      : "#64748b"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
