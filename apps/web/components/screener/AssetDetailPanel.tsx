import { Sparkline } from "../charts/Sparkline";
import { DividendBarChart } from "../charts/DividendBarChart";
import { LinkButton } from "../ui/Button";
import { buildDetailCells, buildDividendHistory, buildSparkline, formatAssetPrice } from "../../lib/calc/screener";
import { formatDecimal, formatPercent } from "../../lib/format";
import type { ScreenerAsset } from "../../lib/types";

export function AssetDetailPanel({ asset, index }: { asset: ScreenerAsset; index: number }) {
  const cells = buildDetailCells(asset);
  const spark = buildSparkline(asset, index);
  const divHistory = buildDividendHistory(asset);
  const maxDiv = Math.max(...divHistory.map((d) => d.value));

  return (
    <div className="bg-surface px-5 py-5 sticky top-4">
      <div className="flex items-baseline gap-2">
        <span className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent">
          {asset.tipo} · {asset.pais}
        </span>
        <span className="text-muted ml-auto font-mono text-[11px]">
          {asset.ticker} · {asset.frecuenciaPago}
        </span>
      </div>
      <h3 className="text-[21px] font-sans font-extrabold mt-1.5 mb-0.5">{asset.nombre}</h3>
      <div className="flex items-baseline gap-2.5 mb-3.5">
        <span className="font-sans font-extrabold text-[26px]">{formatAssetPrice(asset)}</span>
        <span className={`text-[13px] font-bold ${asset.variacionHoy < 0 ? "text-accent-700" : ""}`}>{formatPercent(asset.variacionHoy, true)}</span>
        <span className="text-muted text-[11px]">hoy</span>
      </div>

      <Sparkline data={spark} />
      <div className="flex justify-between text-[9.5px] text-neutral-600 my-0.5 mb-4">
        <span>AGO 23</span>
        <span>precio · 3A</span>
        <span>AGO 26</span>
      </div>

      <div className="grid grid-cols-3 border-t-2 border-divider">
        {cells.map((c) => (
          <div key={c.key} className="pt-2.5 pr-2 pb-2 border-b border-neutral-300">
            <div className="text-muted text-[9.5px] tracking-[0.06em] uppercase">{c.key}</div>
            <div className="text-[13.5px] font-bold mt-0.5">{c.value}</div>
          </div>
        ))}
      </div>

      <h6 className="mt-4 mb-2 text-[10px] uppercase tracking-[0.08em] font-sans font-extrabold">Dividendo por acción · 8 años</h6>
      <DividendBarChart
        data={divHistory.map((d) => ({
          year: `'${d.year}`,
          valueLabel: formatDecimal(d.value, d.value < 10 ? 2 : 1),
          heightPct: (d.value / maxDiv) * 100,
          last: d.isLast,
        }))}
      />

      <div className="flex gap-2 mt-[18px]">
        <LinkButton href="/comparador" variant="primary">
          Añadir al comparador
        </LinkButton>
        <LinkButton href="/panel" variant="secondary">
          Ver cartera
        </LinkButton>
      </div>
    </div>
  );
}
