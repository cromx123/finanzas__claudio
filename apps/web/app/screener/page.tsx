"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { AssetDetailPanel } from "../../components/screener/AssetDetailPanel";
import { FilterBar } from "../../components/screener/FilterBar";
import { ScreenerTable } from "../../components/screener/ScreenerTable";
import { useScreenerUniverse } from "../../hooks/useApi";
import { filterScreener, sortScreener, type ScreenerFilters, type ScreenerSortKey } from "../../lib/calc/screener";

const DEFAULT_FILTERS: ScreenerFilters = { q: "", tipo: "*", yieldMin: 0, peMax: 0, roeMin: 0 };

export default function ScreenerPage() {
  const { data: universe } = useScreenerUniverse();
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<ScreenerSortKey>("yield");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState("SCHD");

  const rows = useMemo(() => {
    if (!universe) return [];
    return sortScreener(filterScreener(universe, filters), sortKey, sortDir);
  }, [universe, filters, sortKey, sortDir]);

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

  const detailAsset = universe.find((a) => a.ticker === selected) ?? universe[0];
  const detailIndex = universe.indexOf(detailAsset);

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{rows.length} resultados</span>} />
      <PageContainer>
        <PageHeader kicker="MÓDULO 2 · SCREENER" title="Análisis fundamental" aside="fundamentales EOD · fuente yfinance" />

        <FilterBar filters={filters} onChange={setFilters} />

        <div className="flex flex-wrap gap-8 mt-[26px] items-start">
          <div className="flex-[1.9_1_560px] min-w-0 overflow-x-auto">
            <ScreenerTable
              rows={rows}
              selected={detailAsset.ticker}
              onSelect={setSelected}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key) => {
                setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
                setSortKey(key);
              }}
            />
            <p className="text-muted text-[11.5px] mt-2.5">
              {rows.length
                ? "Haz clic en una fila para ver la ficha completa. Datos de ejemplo — la versión final consulta market.fundamentals."
                : "Sin resultados con estos filtros."}
            </p>
          </div>

          <div className="flex-[1_1_330px] max-w-[460px] min-w-0">
            <AssetDetailPanel asset={detailAsset} index={detailIndex} />
          </div>
        </div>

        <PageFooter moduleLabel="MÓDULO 2 · SCREENER" right="Filtros y ficha con datos de ejemplo · siguiente módulo: Comparador y proyecciones" />
      </PageContainer>
    </>
  );
}
