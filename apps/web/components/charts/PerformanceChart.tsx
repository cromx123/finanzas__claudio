"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformancePoint } from "../../lib/types";

interface PerformanceChartProps {
  data: PerformancePoint[];
  benchmarkOn: boolean;
  onHoverIndex: (index: number | null) => void;
  height?: number;
}

export function PerformanceChart({ data, benchmarkOn, onHoverIndex, height = 300 }: PerformanceChartProps) {
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
          width={38}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <Tooltip content={() => null} cursor={{ stroke: "var(--color-neutral-500)", strokeWidth: 1 }} />
        {benchmarkOn && (
          <Line
            type="linear"
            dataKey="benchmark"
            stroke="var(--color-accent)"
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 3.5, fill: "var(--color-accent)", stroke: "none" }}
            isAnimationActive={false}
          />
        )}
        <Line
          type="linear"
          dataKey="cartera"
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
