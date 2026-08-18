"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { AssetDetailPanel } from "../../components/screener/AssetDetailPanel";
import { FilterBar } from "../../components/screener/FilterBar";
import { ScreenerTable } from "../../components/screener/ScreenerTable";
import { HelpButton } from "../../components/ui/HelpButton";
import { useAssetDetail, useScreener } from "../../hooks/useApi";
import { filterScreener, sortScreener, type ScreenerFilters, type ScreenerSortKey } from "../../lib/calc/screener";

const DEFAULT_FILTERS: ScreenerFilters = { q: "", tipo: "*", yieldMin: 0, peMax: 0, roeMin: 0 };

export default function ScreenerPage() {
  const { data: universe } = useScreener();
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<ScreenerSortKey>("yield_pct");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState("SCHD");

  const rows = useMemo(() => {
    if (!universe) return [];
    return sortScreener(filterScreener(universe, filters), sortKey, sortDir);
  }, [universe, filters, sortKey, sortDir]);

  const selectedSymbol = universe?.some((a) => a.yahoo_symbol === selected) ? selected : universe?.[0]?.yahoo_symbol ?? null;
  const { data: detail } = useAssetDetail(selectedSymbol);

  if (!universe) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{rows.length} resultados</span>} />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 2 · SCREENER"
          title="Análisis fundamental"
          aside="fundamentales reales · fuente yfinance"
          help={
            <HelpButton title="Screener">
              <p>Explora el universo de activos con datos reales de mercado — filtrá por tipo, yield mínimo, P/E máximo o ROE mínimo.</p>
              <p>Hacé clic en una fila para ver la ficha completa del activo a la derecha: sparkline de precio e historial de dividendos.</p>
            </HelpButton>
          }
        />

        <FilterBar filters={filters} onChange={setFilters} />

        <div className="flex flex-wrap gap-8 mt-[26px] items-start">
          <div className="flex-[1.9_1_560px] min-w-0 overflow-x-auto">
            <ScreenerTable
              rows={rows}
              selected={selectedSymbol ?? ""}
              onSelect={setSelected}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key) => {
                setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
                setSortKey(key);
              }}
            />
            <p className="text-muted text-[11.5px] mt-2.5">
              {rows.length ? "Haz clic en una fila para ver la ficha completa." : "Sin resultados con estos filtros."}
            </p>
          </div>

          <div className="flex-[1_1_330px] max-w-[460px] min-w-0">
            {detail ? <AssetDetailPanel detail={detail} /> : <p className="text-muted text-sm">Cargando ficha…</p>}
          </div>
        </div>

        <PageFooter moduleLabel="MÓDULO 2 · SCREENER" right="siguiente módulo: Comparador y proyecciones" />
      </PageContainer>
    </>
  );
}
