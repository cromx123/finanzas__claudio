"use client";

import { Input } from "../ui/Input";
import { SegmentedControl } from "../ui/SegmentedControl";
import type { ScreenerFilters } from "../../lib/calc/screener";

const TIPO_OPTIONS: { label: string; value: ScreenerFilters["tipo"] }[] = [
  { label: "Todos", value: "*" },
  { label: "Acciones", value: "stock" },
  { label: "ETF", value: "etf" },
  { label: "REIT", value: "reit" },
];
const YIELD_OPTIONS: { label: string; value: `${0 | 3 | 5}` }[] = [
  { label: "Todos", value: "0" },
  { label: "≥3%", value: "3" },
  { label: "≥5%", value: "5" },
];
const PE_OPTIONS: { label: string; value: `${0 | 15 | 25}` }[] = [
  { label: "Todos", value: "0" },
  { label: "≤15", value: "15" },
  { label: "≤25", value: "25" },
];
const ROE_OPTIONS = PE_OPTIONS.map((o) => ({ label: o.label.replace("≤", "≥").replace("≥Todos", "Todos"), value: o.value }));

export function FilterBar({
  filters,
  onChange,
  right,
}: {
  filters: ScreenerFilters;
  onChange: (f: ScreenerFilters) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 flex-wrap border-y-2 border-divider py-3">
      <Input
        placeholder="Buscar ticker o nombre… (ej: SQM-B.SN)"
        className="max-w-[280px]"
        defaultValue={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
      />
      <SegmentedControl options={TIPO_OPTIONS} value={filters.tipo} onChange={(v) => onChange({ ...filters, tipo: v })} size="compact" />
      <div className="flex items-center gap-1.5">
        <span className="text-muted text-[11px]">YIELD</span>
        <SegmentedControl
          options={YIELD_OPTIONS}
          value={String(filters.yieldMin) as `${0 | 3 | 5}`}
          onChange={(v) => onChange({ ...filters, yieldMin: Number(v) as 0 | 3 | 5 })}
          size="compact"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted text-[11px]">P/E</span>
        <SegmentedControl
          options={PE_OPTIONS}
          value={String(filters.peMax) as `${0 | 15 | 25}`}
          onChange={(v) => onChange({ ...filters, peMax: Number(v) as 0 | 15 | 25 })}
          size="compact"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted text-[11px]">ROE</span>
        <SegmentedControl
          options={ROE_OPTIONS}
          value={String(filters.roeMin) as `${0 | 15 | 25}`}
          onChange={(v) => onChange({ ...filters, roeMin: Number(v) as 0 | 15 | 25 })}
          size="compact"
        />
      </div>
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}
