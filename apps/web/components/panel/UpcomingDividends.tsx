import type { UpcomingDividendRow } from "../../lib/calc/portfolio";
import { Tag } from "../ui/Tag";

export function UpcomingDividends({ rows, subLabel }: { rows: UpcomingDividendRow[]; subLabel: string }) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Próximos dividendos</h6>
        <span className="text-muted text-[11px] ml-auto">montos {subLabel}</span>
      </div>
      {rows.map((d, i) => (
        <div key={`${d.ticker}-${i}`} className="flex items-center gap-3 py-2.5 border-t border-divider text-[13px]">
          <span className="font-mono font-bold text-xs flex-none w-[92px] overflow-hidden text-ellipsis">{d.ticker}</span>
          <span className="text-muted text-[11.5px] whitespace-nowrap">{d.fecha}</span>
          <Tag variant={d.estado === "Confirmado" ? "neutral" : "accent"} className="text-[9px]">
            {d.estado}
          </Tag>
          <b className="ml-auto whitespace-nowrap">{d.montoLabel}</b>
        </div>
      ))}
    </div>
  );
}
