import type { GoalRow } from "../../lib/calc/portfolio";
import { ProgressBar } from "../ui/ProgressBar";

export function GoalsPanel({ rows }: { rows: GoalRow[] }) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Objetivos</h6>
        <span className="text-muted text-[11px] ml-auto">avance automático</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="py-2.5 border-t border-divider">
          <div className="flex gap-2 items-baseline text-[12.5px] mb-1.5">
            <b className="min-w-0">{r.label}</b>
            <span className="ml-auto whitespace-nowrap text-[11px] text-muted">
              {r.actualLabel} / {r.objetivoLabel}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <ProgressBar percent={r.widthPct} color="accent" className="flex-1" />
            <b className="text-xs flex-none w-[46px] text-right">{r.pctLabel}</b>
          </div>
        </div>
      ))}
    </div>
  );
}
