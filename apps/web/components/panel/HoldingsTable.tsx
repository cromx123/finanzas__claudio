"use client";

import { Pencil } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import type { ApiHolding } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { ProgressBar } from "../ui/ProgressBar";
import { Tag } from "../ui/Tag";

export type HoldingsSortKey = "valor" | "yoc" | "gp";

interface HoldingsTableProps {
  holdings: ApiHolding[];
  valorTotal: number;
  ccy: Currency;
  decimalesPrecio: number;
  sortKey: HoldingsSortKey;
  sortDir: 1 | -1;
  onSort: (key: HoldingsSortKey) => void;
  onEdit?: (assetId: string) => void;
}

function SortArrow({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return <span> {dir < 0 ? "▼" : "▲"}</span>;
}

export function HoldingsTable({ holdings, valorTotal, ccy, decimalesPrecio, sortKey, sortDir, onSort, onEdit }: HoldingsTableProps) {
  const maxValor = Math.max(...holdings.map((h) => h.market_value), 0.0001);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Activo</th>
            <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Etiquetas</th>
            <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Cantidad</th>
            <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Precio</th>
            <th
              className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider cursor-pointer select-none"
              onClick={() => onSort("valor")}
            >
              Valor
              <SortArrow active={sortKey === "valor"} dir={sortDir} />
            </th>
            <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Peso</th>
            <th
              className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider cursor-pointer select-none"
              onClick={() => onSort("yoc")}
            >
              YoC
              <SortArrow active={sortKey === "yoc"} dir={sortDir} />
            </th>
            <th
              className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider cursor-pointer select-none"
              onClick={() => onSort("gp")}
            >
              G/P no real.
              <SortArrow active={sortKey === "gp"} dir={sortDir} />
            </th>
            {onEdit ? <th className="p-2 border-b-2 border-divider" /> : null}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.asset.id} className="hover:bg-ink/[0.04]">
              <td className="p-2 border-b border-divider">
                <span className="font-mono font-bold text-[12.5px]">{h.asset.yahoo_symbol}</span>
                {h.price_is_stale ? (
                  <span className="ml-2 inline-flex items-center text-[9px] px-1.5 py-0.5 border border-accent text-accent">EOD</span>
                ) : null}
                <div className="text-muted text-[11.5px]">{h.asset.name}</div>
              </td>
              <td className="p-2 border-b border-divider">
                {h.tags.length === 0 ? (
                  <Tag variant="neutral" className="text-[10px]">
                    Sin etiqueta
                  </Tag>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {h.tags.map((t) => (
                      <Tag key={t} variant="neutral" className="text-[10px]">
                        {t}
                      </Tag>
                    ))}
                  </div>
                )}
              </td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatNumber(h.quantity)}</td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatCurrency(h.price, ccy, decimalesPrecio)}</td>
              <td className="p-2 border-b border-divider text-right font-bold text-[13px]">{formatCurrency(h.market_value, ccy)}</td>
              <td className="p-2 border-b border-divider">
                <div className="flex items-center gap-2">
                  <ProgressBar percent={(h.market_value / maxValor) * 100} height={8} className="w-[60px]" />
                  <span className="text-xs">{formatPercent(valorTotal > 0 ? (h.market_value / valorTotal) * 100 : 0)}</span>
                </div>
              </td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatPercent(h.yield_on_cost * 100)}</td>
              <td className={`p-2 border-b border-divider text-right text-[13px] ${h.unrealized_pl < 0 ? "text-accent-700" : ""}`}>
                <b>
                  {h.unrealized_pl >= 0 ? "+" : ""}
                  {formatCurrency(h.unrealized_pl, ccy)}
                </b>
                <span className="text-[11px]"> · {formatPercent(h.cost_basis > 0 ? (h.unrealized_pl / h.cost_basis) * 100 : 0, true)}</span>
              </td>
              {onEdit ? (
                <td className="p-2 border-b border-divider text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(h.asset.id)}
                    aria-label={`Editar ficha de ${h.asset.yahoo_symbol}`}
                    className="text-ink/50 hover:text-accent cursor-pointer"
                  >
                    <Pencil size={14} strokeWidth={1.8} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
