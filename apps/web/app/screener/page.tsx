"use client";

import { useEffect, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { AddAssetForm } from "../../components/screener/AddAssetForm";
import { AssetDetailPanel } from "../../components/screener/AssetDetailPanel";
import { FilterBar } from "../../components/screener/FilterBar";
import { ScreenerTable } from "../../components/screener/ScreenerTable";
import { HelpButton } from "../../components/ui/HelpButton";
import { Pagination } from "../../components/ui/Pagination";
import { useAssetDetail, useScreenerPage } from "../../hooks/useApi";
import type { ScreenerFilters, ScreenerSortKey } from "../../lib/calc/screener";

const DEFAULT_FILTERS: ScreenerFilters = { q: "", tipo: "*", yieldMin: 0, peMax: 0, roeMin: 0 };
const PAGE_SIZE = 14;

export default function ScreenerPage() {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<ScreenerSortKey>("yield_pct");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState("SCHD");
  const [page, setPage] = useState(0);

  // The text search now hits the server per keystroke, so it needs its own
  // debounce (unlike the old fully-client-side filter, which was instant) —
  // same 250ms pattern as TickerAutocomplete.
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Reset to page 1 whenever the filters or sort change — an accepted
  // exception to "don't setState during render" (adjusting state in
  // response to a prop/state change, per React's own guidance), since doing
  // it in an effect would cause an extra render requesting a stale page.
  const [prevFilters, setPrevFilters] = useState(filters);
  const [prevSortKey, setPrevSortKey] = useState(sortKey);
  const [prevSortDir, setPrevSortDir] = useState(sortDir);
  if (filters !== prevFilters || sortKey !== prevSortKey || sortDir !== prevSortDir) {
    setPrevFilters(filters);
    setPrevSortKey(sortKey);
    setPrevSortDir(sortDir);
    setPage(0);
  }

  const { data: screenerPage } = useScreenerPage({
    q: debouncedQ,
    tipo: filters.tipo,
    yieldMin: filters.yieldMin,
    peMax: filters.peMax,
    roeMin: filters.roeMin,
    sortKey,
    sortDir,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const rows = screenerPage?.rows ?? [];
  const total = screenerPage?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: detail } = useAssetDetail(selected);

  if (!screenerPage) {
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
      <NavBar right={<span className="text-muted text-xs">{total} resultados</span>} />
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

        <FilterBar filters={filters} onChange={setFilters} right={<AddAssetForm onAdded={setSelected} />} />

        <div className="flex flex-wrap gap-8 mt-[26px] items-start">
          <div className="flex-[1.9_1_560px] min-w-0 overflow-x-auto">
            <ScreenerTable
              rows={rows}
              selected={selected}
              onSelect={setSelected}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(key) => {
                setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
                setSortKey(key);
              }}
            />
            <div className="flex items-center flex-wrap gap-x-4 mt-2.5">
              <p className="text-muted text-[11.5px]">
                {rows.length ? "Haz clic en una fila para ver la ficha completa." : "Sin resultados con estos filtros."}
              </p>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
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
