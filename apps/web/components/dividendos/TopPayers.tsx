import type { TopMonthRow, TopPayerRow } from "../../lib/calc/dividends";
import { ProgressBar } from "../ui/ProgressBar";

export function TopPayers({ payers, months }: { payers: TopPayerRow[]; months: TopMonthRow[] }) {
  return (
    <div>
      <h6 className="m-0 mb-2.5 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Mayores pagadores · distribución real</h6>
      {payers.map((p) => (
        <div key={p.ticker} className="py-2 border-t border-divider">
          <div className="flex text-xs mb-1.5">
            <span className="font-mono font-bold">{p.ticker}</span>
            <span className="ml-auto">
              <span className="text-muted">{p.totalLabel}</span> · <b>{p.pctLabel}</b>
            </span>
          </div>
          <ProgressBar percent={p.widthPct} height={8} />
        </div>
      ))}
      <h6 className="mt-[22px] mb-2 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Meses más fuertes</h6>
      {months.map((m) => (
        <div key={m.mes} className="flex items-baseline gap-2.5 py-2 border-t border-divider text-[13px]">
          <span className="font-mono font-bold text-xs text-accent">{m.pos}</span>
          <span>{m.mes}</span>
          <b className="ml-auto">{m.totalLabel}</b>
        </div>
      ))}
    </div>
  );
}
