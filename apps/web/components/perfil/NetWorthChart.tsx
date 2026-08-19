"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetWorthPoint } from "../../lib/calc/networth";

function compactAxisValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + "k";
  return v.toFixed(0);
}

export function NetWorthChart({
  data,
  onHoverIndex,
  height = 260,
}: {
  data: NetWorthPoint[];
  onHoverIndex: (index: number | null) => void;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        onMouseMove={(state) => {
          const idx = state?.activeTooltipIndex;
          onHoverIndex(typeof idx === "number" ? idx : null);
        }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        <CartesianGrid vertical={false} stroke="var(--color-neutral-300)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-neutral-600)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-neutral-600)" }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={["auto", "auto"]}
          tickFormatter={compactAxisValue}
        />
        <Tooltip content={() => null} cursor={{ stroke: "var(--color-neutral-500)", strokeWidth: 1 }} />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--color-ink)"
          strokeWidth={2.4}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-ink)", stroke: "none" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
