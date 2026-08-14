"use client";

import { Line, LineChart, ReferenceLine, ResponsiveContainer } from "recharts";

export function Sparkline({ data, height = 88 }: { data: number[]; height?: number }) {
  const points = data.map((v, i) => ({ i, v }));
  const mid = (Math.max(...data) + Math.min(...data)) / 2;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
        <ReferenceLine y={mid} stroke="var(--color-neutral-300)" strokeWidth={1} />
        <Line type="linear" dataKey="v" stroke="var(--color-ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
