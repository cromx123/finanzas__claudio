"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from "recharts";

export interface MonthlyBar {
  label: string;
  value: number;
  valueLabel: string;
  best: boolean;
}

export function MonthlyBarChart({ data, height = 225 }: { data: MonthlyBar[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 8 }} barCategoryGap="18%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-neutral-600)" }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="value" isAnimationActive={false}>
          <LabelList dataKey="valueLabel" position="top" fontSize={9.5} fill="var(--color-neutral-700)" />
          {data.map((d, i) => (
            <Cell key={i} fill={d.best ? "var(--color-accent)" : "var(--color-ink)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
