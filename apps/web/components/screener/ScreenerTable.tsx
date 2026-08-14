"use client";

import { formatAssetPrice, formatAumOrCap, type ScreenerSortKey } from "../../lib/calc/screener";
import { formatDecimal, formatPercent } from "../../lib/format";
import type { ScreenerAsset } from "../../lib/types";
import { Tag } from "../ui/Tag";

interface ScreenerTableProps {
  rows: ScreenerAsset[];
  selected: string;
  onSelect: (ticker: string) => void;
  sortKey: ScreenerSortKey;
  sortDir: 1 | -1;
  onSort: (key: ScreenerSortKey) => void;
}

const COLUMNS: { key: ScreenerSortKey; label: string }[] = [
  { key: "yield", label: "Yield" },
  { key: "cagrDiv5A", label: "CAGR 5A" },
  { key: "pe", label: "P/E" },
  { key: "roe", label: "ROE" },
];

function SortArrow({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return <span> {dir < 0 ? "▼" : "▲"}</span>;
}

export function ScreenerTable({ rows, selected, onSelect, sortKey, sortDir, onSort }: ScreenerTableProps) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr>
          <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Activo</th>
          <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Tipo</th>
          <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Precio</th>
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider cursor-pointer select-none"
              onClick={() => onSort(c.key)}
            >
              {c.label}
              <SortArrow active={sortKey === c.key} dir={sortDir} />
            </th>
          ))}
          <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">M. neta</th>
          <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">ER</th>
          <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">AUM/Cap.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr
            key={a.ticker}
            onClick={() => onSelect(a.ticker)}
            className="cursor-pointer"
            style={{ background: a.ticker === selected ? "var(--color-surface)" : "transparent" }}
          >
            <td className="p-2 border-b border-divider">
              <span className="font-mono font-bold text-xs">{a.ticker}</span>
              <div className="text-muted text-[11px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[170px]">
                {a.nombre} · {a.pais}
              </div>
            </td>
            <td className="p-2 border-b border-divider">
              <Tag variant="neutral" className="text-[9.5px] px-1.5">
                {a.tipo}
              </Tag>
            </td>
            <td className="p-2 border-b border-divider text-right whitespace-nowrap">{formatAssetPrice(a)}</td>
            <td className="p-2 border-b border-divider text-right font-bold">{formatPercent(a.yield)}</td>
            <td className={`p-2 border-b border-divider text-right ${a.cagrDiv5A < 0 ? "text-accent-700" : ""}`}>{formatPercent(a.cagrDiv5A, true)}</td>
            <td className="p-2 border-b border-divider text-right">{a.pe === null ? "—" : formatDecimal(a.pe, 1)}</td>
            <td className="p-2 border-b border-divider text-right">{a.roe === null ? "—" : formatPercent(a.roe)}</td>
            <td className="p-2 border-b border-divider text-right">{a.margenNeta === null ? "—" : formatPercent(a.margenNeta)}</td>
            <td className="p-2 border-b border-divider text-right">{a.expenseRatio === null ? "—" : formatPercent(a.expenseRatio)}</td>
            <td className="p-2 border-b border-divider text-right">{formatAumOrCap(a.aumOCap)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
