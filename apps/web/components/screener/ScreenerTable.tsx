"use client";

import { formatAssetPrice, formatAumOrCap, type ScreenerSortKey } from "../../lib/calc/screener";
import { formatDecimal, formatPercent } from "../../lib/format";
import type { ApiScreenerAsset } from "../../lib/api/types";
import { Tag } from "../ui/Tag";

interface ScreenerTableProps {
  rows: ApiScreenerAsset[];
  selected: string;
  onSelect: (yahooSymbol: string) => void;
  sortKey: ScreenerSortKey;
  sortDir: 1 | -1;
  onSort: (key: ScreenerSortKey) => void;
}

const COLUMNS: { key: ScreenerSortKey; label: string }[] = [
  { key: "yield_pct", label: "Yield" },
  { key: "cagr_div_5y", label: "CAGR 5A" },
  { key: "pe_ratio", label: "P/E" },
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
            key={a.id}
            onClick={() => onSelect(a.yahoo_symbol)}
            className="cursor-pointer"
            style={{ background: a.yahoo_symbol === selected ? "var(--color-surface)" : "transparent" }}
          >
            <td className="p-2 border-b border-divider">
              <span className="font-mono font-bold text-xs">{a.yahoo_symbol}</span>
              <div className="text-muted text-[11px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[170px]">
                {a.name} · {a.country}
              </div>
            </td>
            <td className="p-2 border-b border-divider">
              <Tag variant="neutral" className="text-[9.5px] px-1.5">
                {a.type}
              </Tag>
            </td>
            <td className="p-2 border-b border-divider text-right whitespace-nowrap">{formatAssetPrice(a)}</td>
            <td className="p-2 border-b border-divider text-right font-bold">{a.yield_pct === null ? "—" : formatPercent(a.yield_pct)}</td>
            <td className={`p-2 border-b border-divider text-right ${(a.cagr_div_5y ?? 0) < 0 ? "text-accent-700" : ""}`}>
              {a.cagr_div_5y === null ? "—" : formatPercent(a.cagr_div_5y, true)}
            </td>
            <td className="p-2 border-b border-divider text-right">{a.pe_ratio === null ? "—" : formatDecimal(a.pe_ratio, 1)}</td>
            <td className="p-2 border-b border-divider text-right">{a.roe === null ? "—" : formatPercent(a.roe)}</td>
            <td className="p-2 border-b border-divider text-right">{a.net_margin === null ? "—" : formatPercent(a.net_margin)}</td>
            <td className="p-2 border-b border-divider text-right">{a.expense_ratio === null ? "—" : formatPercent(a.expense_ratio)}</td>
            <td className="p-2 border-b border-divider text-right">{formatAumOrCap(a.aum_or_cap)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
