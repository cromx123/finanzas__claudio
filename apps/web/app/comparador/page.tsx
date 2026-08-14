"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { ComparadorControls } from "../../components/comparador/ComparadorControls";
import { ProjectionChart } from "../../components/charts/ProjectionChart";
import { useComparadorAssets } from "../../hooks/useApi";
import { buildCostOfLivingSeries, buildMetricRows, buildResultRow, simulate } from "../../lib/calc/comparador";
import { formatCompactUsd, formatPercent } from "../../lib/format";
import type { ComparadorParams } from "../../lib/types";

const DEFAULT_PARAMS: ComparadorParams = {
  activoA: "SCHD",
  activoB: "DGRO",
  inversionInicial: 3000,
  aporteMensual: 100,
  costoVidaMensual: 1000,
  inflacionAnual: 2,
  horizonteAnios: 30,
  drip: true,
};

export default function ComparadorPage() {
  const { data: assets } = useComparadorAssets();
  const [params, setParams] = useState<ComparadorParams>(DEFAULT_PARAMS);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const derived = useMemo(() => {
    if (!assets) return null;
    const a = assets[params.activoA];
    const b = assets[params.activoB];
    const simA = simulate(a, params);
    const simB = simulate(b, params);
    const cvSerie = buildCostOfLivingSeries(params);
    const chartData = simA.divSerie.map((v, i) => ({
      year: 2026 + i,
      a: v,
      b: simB.divSerie[i],
      costoVida: cvSerie[i],
    }));
    return { a, b, simA, simB, cvSerie, chartData };
  }, [assets, params]);

  if (!derived) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const { a, b, simA, simB, cvSerie, chartData } = derived;
  const metricRows = buildMetricRows(a, b);
  const resultRows = [
    buildResultRow(params.activoA, simA, "var(--color-ink)", params.horizonteAnios),
    buildResultRow(params.activoB, simB, "var(--color-accent)", params.horizonteAnios),
  ];
  const hoverPoint = hoverIndex !== null ? chartData[hoverIndex] : null;
  const anioFin = 2026 + params.horizonteAnios;

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">interés compuesto · DRIP · inflación</span>} />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 3 · COMPARADOR Y PROYECCIONES"
          title="Compara, proyecta y evalúa a largo plazo"
          aside="proyección en US$ · activos .SN convertidos por fx"
        />

        <ComparadorControls params={params} onChange={setParams} />

        <div className="flex flex-wrap gap-9 mt-[30px] items-start">
          <div className="flex-[1_1_340px] min-w-0">
            <h6 className="m-0 mb-1.5 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Métricas lado a lado</h6>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Métrica</th>
                  <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">{params.activoA}</th>
                  <th className="text-right text-[11px] uppercase text-accent-700 p-2 border-b-2 border-divider">{params.activoB}</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map((m) => (
                  <tr key={m.label}>
                    <td className="text-muted text-xs p-2 border-b border-divider">{m.label}</td>
                    <td className="text-right font-bold p-2 border-b border-divider">{m.a}</td>
                    <td className="text-right font-bold p-2 border-b border-divider">{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex-[1.6_1_460px] min-w-0">
            <div className="flex items-center gap-4 flex-wrap mb-2.5">
              <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Dividendo anual vs costo de vida</h6>
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="inline-block w-[18px] h-[3px] bg-ink" />
                {params.activoA}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="inline-block w-[18px] h-[3px] bg-accent" />
                {params.activoB}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="inline-block w-[18px] border-t-2 border-dashed border-neutral-600" />
                Costo de vida
              </span>
              {hoverPoint ? (
                <span className="text-muted text-[11px] font-mono ml-auto">
                  {hoverPoint.year} · {params.activoA} {formatCompactUsd(hoverPoint.a)} · {params.activoB} {formatCompactUsd(hoverPoint.b)}
                </span>
              ) : null}
            </div>
            <ProjectionChart data={chartData} onHoverIndex={setHoverIndex} />
            <p className="text-muted text-[11.5px] mt-2">
              Costo de vida al año {anioFin}: {formatCompactUsd(cvSerie[params.horizonteAnios])} anual (
              {formatCompactUsd(cvSerie[params.horizonteAnios] / 12)}/mes), con inflación {formatPercent(params.inflacionAnual)} anual.
            </p>
          </div>
        </div>

        <div className="mt-9">
          <h6 className="m-0 mb-2 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Resultado al año {anioFin}</h6>
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Activo</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Capital final</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Total aportes</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Div. cobrados</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Dividendo anual</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Dividendo mensual</th>
                <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">YoC final</th>
                <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">¿Cubre costo de vida?</th>
              </tr>
            </thead>
            <tbody>
              {resultRows.map((r) => (
                <tr key={r.ticker}>
                  <td className="p-2 border-b border-divider">
                    <span className="inline-block w-[9px] h-[9px] mr-2" style={{ background: r.colorVar }} />
                    <span className="font-mono font-bold text-[12.5px]">{r.ticker}</span>
                  </td>
                  <td className="text-right font-bold p-2 border-b border-divider">{r.capital}</td>
                  <td className="text-right p-2 border-b border-divider">{r.aportes}</td>
                  <td className="text-right p-2 border-b border-divider">{r.dividendosCobrados}</td>
                  <td className="text-right font-bold p-2 border-b border-divider">{r.dividendoAnual}</td>
                  <td className="text-right p-2 border-b border-divider">{r.dividendoMensual}</td>
                  <td className="text-right p-2 border-b border-divider">{r.yoc}</td>
                  <td className={`p-2 border-b border-divider font-bold ${r.cubreNegative ? "text-accent-700" : ""}`}>{r.cubre}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted text-[11.5px] mt-2.5">
            Modelo mensual: el capital crece a la rentabilidad promedio anual del activo, el yield evoluciona con el CAGR del dividendo
            {params.drip ? " y los dividendos se reinvierten (DRIP activo)" : "; los dividendos se cobran sin reinvertir (DRIP inactivo)"}. El costo de
            vida se ajusta por inflación cada año. Cifras brutas, antes de retención.
          </p>
        </div>

        <PageFooter moduleLabel="MÓDULO 3 · COMPARADOR" right="ir al Calendario de dividendos (M4) →" />
      </PageContainer>
    </>
  );
}
