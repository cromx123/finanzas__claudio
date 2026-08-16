import { formatCurrency } from "../../lib/format";
import type { ApiHolding } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { Select } from "../ui/Input";

export function TagAssignPanel({
  holdings,
  ccy,
  tags,
  selected,
  onSelect,
  onToggleTag,
}: {
  holdings: ApiHolding[];
  ccy: Currency;
  tags: string[];
  selected: ApiHolding;
  onSelect: (yahooSymbol: string) => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div className="bg-surface px-5 py-[18px]">
      <div className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent">Asignar etiquetas</div>
      <div className="my-2.5 mb-3">
        <Select label="Activo" value={selected.asset.yahoo_symbol} onChange={(e) => onSelect(e.target.value)}>
          {holdings.map((h) => (
            <option key={h.asset.id} value={h.asset.yahoo_symbol}>
              {h.asset.yahoo_symbol} — {h.asset.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <b className="text-[13px]">{selected.asset.name}</b>
        <span className="text-muted ml-auto text-[11px]">
          {formatCurrency(selected.market_value, ccy, 0)} · {formatCurrency(selected.quantity * selected.dividend_per_share_ttm, ccy, 2)}/año
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = selected.tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`text-[11px] font-bold tracking-wide px-2.5 py-1.5 border cursor-pointer ${
                active ? "bg-accent text-bg border-accent" : "bg-transparent text-ink border-divider hover:bg-ink/5"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <p className="text-muted text-[11px] mt-3.5">Toca una etiqueta para asignarla o quitarla. La tabla y los pesos se recalculan al instante.</p>
    </div>
  );
}
