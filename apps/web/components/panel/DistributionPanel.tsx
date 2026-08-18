"use client";

import type { AllocationRow } from "../../lib/calc/portfolio";
import type { AllocBy } from "../../lib/types";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ProgressBar } from "../ui/ProgressBar";

const OPTIONS: { label: string; value: AllocBy }[] = [
  { label: "Tipo", value: "tipo" },
  { label: "Sector", value: "sector" },
  { label: "País", value: "pais" },
];

export function DistributionPanel({ rows, allocBy, onChange }: { rows: AllocationRow[]; allocBy: AllocBy; onChange: (v: AllocBy) => void }) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Distribución</h6>
        <SegmentedControl options={OPTIONS} value={allocBy} onChange={onChange} size="compact" className="ml-auto" />
      </div>
      {rows.map((r) => (
        <div key={r.label} className="py-2.5 border-t border-divider">
          <div className="flex text-[12.5px] mb-1.5">
            <b>{r.label}</b>
            <span className="ml-auto">
              <span className="text-muted">{r.valueLabel}</span> · {r.pctLabel}
            </span>
          </div>
          <ProgressBar percent={r.pct * 100} />
        </div>
      ))}
    </div>
  );
}
