import { Sparkline } from "../charts/Sparkline";
import { DividendBarChart } from "../charts/DividendBarChart";
import { LinkButton } from "../ui/Button";
import { buildDetailCells, formatAssetPrice } from "../../lib/calc/screener";
import { formatDecimal, formatPercent } from "../../lib/format";
import type { ApiAssetDetail } from "../../lib/api/types";

export function AssetDetailPanel({ detail }: { detail: ApiAssetDetail }) {
  const { asset, sparkline, dividend_history } = detail;
  const cells = buildDetailCells(asset);
  const maxDiv = Math.max(...dividend_history.map((d) => d.amount_per_share), 0.0001);

  return (
    <div className="bg-surface px-5 py-5 sticky top-4">
      <div className="flex items-baseline gap-2">
        <span className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent">
          {asset.type} · {asset.country}
        </span>
        <span className="text-muted ml-auto font-mono text-[11px]">
          {asset.yahoo_symbol} · {asset.dividend_frequency ?? "—"}
        </span>
      </div>
      <h3 className="text-[21px] font-sans font-extrabold mt-1.5 mb-0.5">{asset.name}</h3>
      <div className="flex items-baseline gap-2.5 mb-3.5">
        <span className="font-sans font-extrabold text-[26px]">{formatAssetPrice(asset)}</span>
        <span className={`text-[13px] font-bold ${(asset.change_today_pct ?? 0) < 0 ? "text-accent-700" : ""}`}>
          {asset.change_today_pct === null ? "—" : formatPercent(asset.change_today_pct, true)}
        </span>
        <span className="text-muted text-[11px]">hoy</span>
      </div>

      {sparkline.length > 1 ? (
        <Sparkline data={sparkline} />
      ) : (
        <p className="text-muted text-xs py-6 text-center">Sin histórico de precio suficiente todavía.</p>
      )}
      <div className="flex justify-between text-[9.5px] text-neutral-600 my-0.5 mb-4">
        <span>hace 3 años</span>
        <span>precio · 3A</span>
        <span>hoy</span>
      </div>

      <div className="grid grid-cols-3 border-t-2 border-divider">
        {cells.map((c) => (
          <div key={c.key} className="pt-2.5 pr-2 pb-2 border-b border-neutral-300">
            <div className="text-muted text-[9.5px] tracking-[0.06em] uppercase">{c.key}</div>
            <div className="text-[13.5px] font-bold mt-0.5">{c.value}</div>
          </div>
        ))}
      </div>

      <h6 className="mt-4 mb-2 text-[10px] uppercase tracking-[0.08em] font-sans font-extrabold">Dividendo por acción · histórico</h6>
      {dividend_history.length === 0 ? (
        <p className="text-muted text-xs">Sin historial de dividendos.</p>
      ) : (
        <DividendBarChart
          data={dividend_history.map((d) => ({
            year: `'${d.year.slice(2)}`,
            valueLabel: formatDecimal(d.amount_per_share, d.amount_per_share < 10 ? 2 : 1),
            heightPct: (d.amount_per_share / maxDiv) * 100,
            last: d.is_latest,
          }))}
        />
      )}

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
