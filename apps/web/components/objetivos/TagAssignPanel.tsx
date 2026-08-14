import { formatUsd } from "../../lib/format";
import type { ConvertedAsset } from "../../lib/calc/goals";
import { Select } from "../ui/Input";

export function TagAssignPanel({
  assets,
  tags,
  selected,
  onSelect,
  assignedTags,
  onToggleTag,
}: {
  assets: ConvertedAsset[];
  tags: string[];
  selected: ConvertedAsset;
  onSelect: (ticker: string) => void;
  assignedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div className="bg-surface px-5 py-[18px]">
      <div className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent">Asignar etiquetas</div>
      <div className="my-2.5 mb-3">
        <Select label="Activo" value={selected.ticker} onChange={(e) => onSelect(e.target.value)}>
          {assets.map((a) => (
            <option key={a.ticker} value={a.ticker}>
              {a.ticker} — {a.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-baseline gap-2 mb-2.5">
        <b className="text-[13px]">{selected.nombre}</b>
        <span className="text-muted ml-auto text-[11px]">
          {formatUsd(selected.valorUsd)} · {formatUsd(selected.dividendoUsdAnual, 2)}/año
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = assignedTags.includes(tag);
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
