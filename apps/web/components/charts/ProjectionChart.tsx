"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ProjectionPoint {
  year: number;
  a: number;
  b: number;
  costoVida: number;
}

interface ProjectionChartProps {
  data: ProjectionPoint[];
  onHoverIndex: (index: number | null) => void;
  height?: number;
}

export function ProjectionChart({ data, onHoverIndex, height = 330 }: ProjectionChartProps) {
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
          dataKey="year"
          tick={{ fontSize: 10, fill: "var(--color-neutral-600)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-neutral-600)" }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v.toFixed(0)}`)}
        />
        <Tooltip content={() => null} cursor={{ stroke: "var(--color-neutral-500)", strokeWidth: 1 }} />
        <Line
          type="linear"
          dataKey="costoVida"
          stroke="var(--color-neutral-600)"
          strokeWidth={1.6}
          strokeDasharray="6 5"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="b"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3.5, fill: "var(--color-accent)", stroke: "none" }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="a"
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
