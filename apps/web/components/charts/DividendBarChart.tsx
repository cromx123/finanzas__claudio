"use client";

export interface DividendBarDatum {
  year: string;
  valueLabel: string;
  heightPct: number;
  last: boolean;
}

export function DividendBarChart({ data }: { data: DividendBarDatum[] }) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => (
        <div key={d.year} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-24">
          <span className="text-[8.5px] text-neutral-700">{d.valueLabel}</span>
          <div
            className={`w-[72%] ${d.last ? "bg-accent" : "bg-ink"}`}
            style={{ height: `${Math.max(3, d.heightPct)}%` }}
          />
          <span className="text-[8.5px] text-neutral-600">{d.year}</span>
        </div>
      ))}
    </div>
  );
}
