"use client";

import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import type { ValuedHolding } from "../../lib/calc/portfolio";
import type { Currency } from "../../lib/types";
import { ProgressBar } from "../ui/ProgressBar";
import { Tag } from "../ui/Tag";

export type HoldingsSortKey = "valor" | "yoc" | "gp";

interface HoldingsTableProps {
  holdings: ValuedHolding[];
  ccy: Currency;
  decimales: number;
  decimalesPrecio: number;
  sortKey: HoldingsSortKey;
  sortDir: 1 | -1;
  onSort: (key: HoldingsSortKey) => void;
}

function SortArrow({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return <span> {dir < 0 ? "▼" : "▲"}</span>;
}

export function HoldingsTable({ holdings, ccy, decimales, decimalesPrecio, sortKey, sortDir, onSort }: HoldingsTableProps) {
  const maxPeso = Math.max(...holdings.map((h) => h.peso), 0.0001);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Activo</th>
            <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Etiqueta</th>
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
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.ticker} className="hover:bg-ink/[0.04]">
              <td className="p-2 border-b border-divider">
                <span className="font-mono font-bold text-[12.5px]">{h.ticker}</span>
                {h.stale ? (
                  <span className="ml-2 inline-flex items-center text-[9px] px-1.5 py-0.5 border border-accent text-accent">EOD</span>
                ) : null}
                <div className="text-muted text-[11.5px]">{h.nombre}</div>
              </td>
              <td className="p-2 border-b border-divider">
                <Tag variant="neutral" className="text-[10px]">
                  {h.tag}
                </Tag>
              </td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatNumber(h.cantidad)}</td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatCurrency(h.precio, ccy, decimalesPrecio)}</td>
              <td className="p-2 border-b border-divider text-right font-bold text-[13px]">{formatCurrency(h.valor, ccy, decimales)}</td>
              <td className="p-2 border-b border-divider">
                <div className="flex items-center gap-2">
                  <ProgressBar percent={(h.peso / maxPeso) * 100} height={8} className="w-[60px]" />
                  <span className="text-xs">{formatPercent(h.peso * 100)}</span>
                </div>
              </td>
              <td className="p-2 border-b border-divider text-right text-[13px]">{formatPercent(h.yoc * 100)}</td>
              <td className={`p-2 border-b border-divider text-right text-[13px] ${h.gp < 0 ? "text-accent-700" : ""}`}>
                <b>
                  {h.gp >= 0 ? "+" : ""}
                  {formatCurrency(h.gp, ccy, decimales)}
                </b>
                <span className="text-[11px]"> · {formatPercent((h.gp / h.costo) * 100, true)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
