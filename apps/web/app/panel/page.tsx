"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { StaleBanner } from "../../components/layout/StaleBanner";
import { PerformanceChart } from "../../components/charts/PerformanceChart";
import { DistributionPanel } from "../../components/panel/DistributionPanel";
import { GoalsPanel } from "../../components/panel/GoalsPanel";
import { HoldingsTable, type HoldingsSortKey } from "../../components/panel/HoldingsTable";
import { KpiGrid, type KpiCell } from "../../components/panel/KpiGrid";
import { UpcomingDividends } from "../../components/panel/UpcomingDividends";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Tag } from "../../components/ui/Tag";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { usePortfolioPreferences } from "../../context/PortfolioPreferences";
import { usePerformanceInputs, usePortfolio } from "../../hooks/useApi";
import {
  computeAllocation,
  computeUpcomingDividends,
  makeGoalRow,
  sortHoldings,
  valuateHoldings,
} from "../../lib/calc/portfolio";
import { buildPerformancePoints } from "../../lib/calc/series";
import { formatCurrency, formatDecimal, formatPercent } from "../../lib/format";
import { generateSeries } from "../../lib/random";
import type { AllocBy, RangeKey } from "../../lib/types";

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

export default function PanelPage() {
  const { portfolio, setPortfolio, netoRetencion, toggleNetoRetencion } = usePortfolioPreferences();
  const { data: port } = usePortfolio(portfolio);
  const { data: perfInputs } = usePerformanceInputs(portfolio);

  const [range, setRange] = useState<RangeKey>("3A");
  const [bench, setBench] = useState(true);
  const [allocBy, setAllocBy] = useState<AllocBy>("tag");
  const [sortKey, setSortKey] = useState<HoldingsSortKey>("valor");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const valuation = useMemo(() => (port ? valuateHoldings(port.holdings) : null), [port]);
  const sortedHoldings = useMemo(
    () => (valuation ? sortHoldings(valuation.holdings, sortKey, sortDir) : []),
    [valuation, sortKey, sortDir]
  );

  const perfPoints = useMemo(() => {
    if (!perfInputs) return [];
    const full = generateSeries(perfInputs.seed, perfInputs.drift, perfInputs.vol);
    const fullBench = generateSeries(perfInputs.benchmark.seed, perfInputs.benchmark.drift, perfInputs.benchmark.vol);
    return buildPerformancePoints(full, fullBench, range);
  }, [perfInputs, range]);

  if (!port || !valuation) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const wh = netoRetencion ? port.retencion : 0;
  const dividendoProyectado = valuation.dividendoProyectadoBruto * (1 - wh);
  const retornoTotal = (valuation.valorTotal + port.dividendosCobrados + port.gpRealizada - port.aportes) / port.aportes;
  const subDivLabel = netoRetencion ? "neto de retención" : "bruto";
  const staleTickers = valuation.holdings.filter((h) => h.stale).map((h) => h.ticker);

  const allocRows = computeAllocation(valuation.holdings, valuation.valorTotal, allocBy, port.moneda, port.decimales);
  const upcomingRows = computeUpcomingDividends(port.proximosDividendos, wh, port.moneda, port.decimalesPrecio);
  const goalRows = [
    makeGoalRow("Dividendo mensual", dividendoProyectado / 12, port.objetivos.dividendoMensual, port.moneda, port.decimalesPrecio),
    makeGoalRow("Cobertura costo de vida", dividendoProyectado / 12, port.objetivos.costoVida, port.moneda, port.decimalesPrecio),
    makeGoalRow("Próximo gran hito · patrimonio", valuation.valorTotal, port.objetivos.hitoPatrimonio, port.moneda, port.decimales),
  ];

  const kpis: KpiCell[] = [
    { label: "Valor total de la cartera", value: formatCurrency(valuation.valorTotal, port.moneda, port.decimales), sub: "a precio de cierre" },
    {
      label: "Rentabilidad total",
      value: formatPercent(retornoTotal * 100, true),
      sub: "incluye dividendos y G/P realizada",
      colorClass: retornoTotal < 0 ? "text-accent-700" : undefined,
    },
    { label: "Aportes de capital", value: formatCurrency(port.aportes, port.moneda, port.decimales), sub: "desde ENE 2022" },
    { label: "Compras totales", value: formatCurrency(port.comprasTotales, port.moneda, port.decimales), sub: "acumulado histórico" },
    { label: "Dividendos cobrados", value: formatCurrency(port.dividendosCobrados, port.moneda, port.decimales), sub: `histórico, ${subDivLabel}` },
    {
      label: "G/P realizada",
      value: `${port.gpRealizada >= 0 ? "+" : ""}${formatCurrency(port.gpRealizada, port.moneda, port.decimales)}`,
      sub: "ventas cerradas",
    },
    {
      label: "G/P no realizada",
      value: `${valuation.gpNoRealizada >= 0 ? "+" : ""}${formatCurrency(valuation.gpNoRealizada, port.moneda, port.decimales)}`,
      sub: "valor − costo de posiciones abiertas",
      colorClass: valuation.gpNoRealizada < 0 ? "text-accent-700" : undefined,
    },
    { label: "Yield on Cost", value: formatPercent((valuation.dividendoProyectadoBruto / valuation.costoTotal) * 100), sub: "dividendo anual ÷ costo, bruto" },
    { label: "Dividendo mensual", value: formatCurrency(dividendoProyectado / 12, port.moneda, port.decimalesPrecio), sub: `promedio 12m, ${subDivLabel}` },
    { label: "Dividendos proyectados", value: formatCurrency(dividendoProyectado, port.moneda, port.decimales), sub: `próximos 12 meses, ${subDivLabel}` },
  ];

  const hoverPoint = hoverIndex !== null ? perfPoints[hoverIndex] : null;

  return (
    <>
      <NavBar
        right={
          <>
            <SegmentedControl
              options={[
                { label: "Dividendos Chile", value: "chile" as const },
                { label: "Global Dividendos", value: "global" as const },
              ]}
              value={portfolio}
              onChange={setPortfolio}
              variant="accent"
            />
            <Tag variant="outline">{port.moneda}</Tag>
            <ToggleButton active={netoRetencion} onClick={toggleNetoRetencion} variant="accent">
              Neto de retención
            </ToggleButton>
          </>
        }
      />
      {staleTickers.length > 0 && portfolio === "chile" && (
        <StaleBanner>
          DATOS · BOLSA DE SANTIAGO — {staleTickers.join(", ")} sirve el último cierre disponible (is_stale) · ingesta EOD 13 AGO 17:06 CLT
        </StaleBanner>
      )}
      <PageContainer>
        <PageHeader kicker="MÓDULO 1 · PANEL" title={port.nombre} aside="Actualizado 14 AGO 2026 · 17:06 CLT" />

        <KpiGrid cells={kpis} />

        <div className="mt-11">
          <div className="flex items-center gap-[18px] flex-wrap mb-3.5">
            <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Evolución histórica — base 100</h6>
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-[18px] h-[3px] bg-ink" />
              Cartera
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-[18px] h-[3px] bg-accent" />
              S&amp;P 500
            </span>
            <span className="text-muted text-[11.5px] font-mono">
              {hoverPoint ? `${hoverPoint.label} · Cartera ${formatDecimal(hoverPoint.cartera)} · S&P 500 ${formatDecimal(hoverPoint.benchmark)}` : ""}
            </span>
            <div className="ml-auto flex items-center gap-2.5">
              <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} size="compact" />
              <ToggleButton active={bench} onClick={() => setBench((v) => !v)} variant="ink">
                VS S&amp;P 500
              </ToggleButton>
            </div>
          </div>
          <PerformanceChart data={perfPoints} benchmarkOn={bench} onHoverIndex={setHoverIndex} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-11">
          <DistributionPanel rows={allocRows} allocBy={allocBy} onChange={setAllocBy} />
          <GoalsPanel rows={goalRows} />
          <UpcomingDividends rows={upcomingRows} subLabel={subDivLabel} />
        </div>

        <div className="mt-12">
          <h6 className="m-0 mb-2.5 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Posiciones — {port.holdings.length} activos</h6>
          <HoldingsTable
            holdings={sortedHoldings}
            ccy={port.moneda}
            decimales={port.decimales}
            decimalesPrecio={port.decimalesPrecio}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => {
              setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
              setSortKey(key);
            }}
          />
        </div>

        <PageFooter
          moduleLabel="MÓDULO 1 · PANEL"
          right={<>Próximos pasos: ajustar métricas a tu planilla real</>}
        />
      </PageContainer>
    </>
  );
}
