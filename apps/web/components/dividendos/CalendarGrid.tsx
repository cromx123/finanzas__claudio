import type { CalendarCell } from "../../lib/calc/dividends";

const DOT_CLASSES: Record<CalendarCell["eventos"][number]["variant"], string> = {
  pagado: "bg-ink border-ink",
  confirmado: "bg-accent border-accent",
  estimado: "bg-transparent border-neutral-600",
};

export function CalendarGrid({ cells }: { cells: CalendarCell[] }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {cells.map((c) => (
          <div key={c.mes} className="bg-surface px-3.5 pt-3 pb-2.5" style={{ borderTop: `2px solid ${c.isBest ? "var(--color-accent)" : "var(--color-divider)"}` }}>
            <div className="flex items-baseline mb-2">
              <b className="text-[11px] tracking-[0.08em]">{c.mes}</b>
              <b className="ml-auto text-[13px]">{c.totalLabel}</b>
            </div>
            {c.eventos.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                <span className={`inline-block w-2 h-2 rounded-full border-[1.5px] flex-none ${DOT_CLASSES[e.variant]}`} />
                <span className="font-mono text-[10.5px]">{e.ticker}</span>
                <span className="text-muted ml-auto text-[10.5px] whitespace-nowrap">{e.total}</span>
              </div>
            ))}
            <div className="text-muted text-[10px] mt-0.5">{c.more}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-[9px] h-[9px] rounded-full bg-ink" />
          Pagado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-[9px] h-[9px] rounded-full bg-accent" />
          Confirmado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-[9px] h-[9px] rounded-full border-[1.5px] border-neutral-600" />
          Estimado
        </span>
      </div>
    </div>
  );
}
