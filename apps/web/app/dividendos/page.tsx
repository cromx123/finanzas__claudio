"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { MonthlyBarChart } from "../../components/charts/MonthlyBarChart";
import { CalendarGrid } from "../../components/dividendos/CalendarGrid";
import { TopPayers } from "../../components/dividendos/TopPayers";
import { HelpButton } from "../../components/ui/HelpButton";
import { Select } from "../../components/ui/Input";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tag } from "../../components/ui/Tag";
import { usePortfolioUi } from "../../context/Portfolios";
import { useDividendCalendar, usePortfolios } from "../../hooks/useApi";
import {
  bestMonthIndex,
  buildCalendarCells,
  buildDetailRows,
  buildMonthlyBars,
  buildTopMonths,
  buildTopPayers,
  mapApiEvents,
  monthlyTotals,
} from "../../lib/calc/dividends";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import type { Currency, DividendStatus } from "../../lib/types";

const FILTER_OPTIONS: { label: string; value: DividendStatus | "*" }[] = [
  { label: "Todos", value: "*" },
  { label: "Pagados", value: "Pagado" },
  { label: "Estimados", value: "Estimado" },
];
const CURRENT_YEAR = new Date().getFullYear();

export default function DividendosPage() {
  const { activePortfolioId, setActivePortfolioId, netoRetencion, toggleNetoRetencion } = usePortfolioUi();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.find((p) => p.id === activePortfolioId)?.id ?? portfolios?.[0]?.id ?? null;
  const portfolio = portfolios?.find((p) => p.id === portfolioId) ?? null;

  const { data: calendar } = useDividendCalendar(portfolioId, CURRENT_YEAR);
  const [filtro, setFiltro] = useState<DividendStatus | "*">("*");

  const derived = useMemo(() => {
    if (!calendar || !portfolio) return null;
    const ccy = portfolio.currency as Currency;
    const events = mapApiEvents(calendar.events, netoRetencion);
    const monthly = monthlyTotals(events);
    const best = bestMonthIndex(monthly);
    const totalY = monthly.reduce((s, v) => s + v, 0);
    const pagadoSum = events.filter((e) => e.estado === "Pagado").reduce((s, e) => s + e.total, 0);
    return {
      events,
      monthly,
      best,
      totalY,
      pagadoSum,
      bars: buildMonthlyBars(monthly, best, ccy),
      calCells: buildCalendarCells(events, monthly, best, ccy),
      topPay: buildTopPayers(events, totalY, ccy),
      topMonths: buildTopMonths(monthly, ccy),
      detailRows: buildDetailRows(events, filtro, ccy, CURRENT_YEAR),
    };
  }, [calendar, portfolio, netoRetencion, filtro]);

  if (!portfolios || portfolios.length === 0) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm py-10">Todavía no tienes portafolios — créalos desde el Panel para ver tu calendario de dividendos.</p>
        </PageContainer>
      </>
    );
  }

  if (!portfolio || !calendar || !derived) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const ccy = portfolio.currency as Currency;
  const notaWh = netoRetencion ? "retención aplicada según tus reglas de impuestos por país" : "montos brutos, sin retención";

  return (
    <>
      <NavBar
        right={
          <>
            <Select
              value={portfolio.id}
              onChange={(e) => setActivePortfolioId(e.target.value)}
              className="w-auto min-h-0 py-1.5 pr-7 text-xs font-bold"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <ToggleButton active={netoRetencion} onClick={toggleNetoRetencion} variant="ink">
              Neto de retención
            </ToggleButton>
          </>
        }
      />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 4 · CALENDARIO Y FLUJO DE CAJA"
          title={`Dividendos ${CURRENT_YEAR} — ${portfolio.name}`}
          aside={notaWh}
          help={
            <HelpButton title="Dividendos">
              <p>
                Calendario de dividendos del año para el portafolio seleccionado — <b>Pagado</b> son cobros ya ocurridos, <b>Estimado</b>{" "}
                es una proyección con la frecuencia histórica del activo.
              </p>
              <p>Los montos “neto” descuentan la retención de impuestos configurada por país en tu perfil de usuario.</p>
            </HelpButton>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y divide-divider border-y-2 border-divider">
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Total del año</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatCurrency(derived.totalY, ccy)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Promedio mensual</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatCurrency(derived.totalY / 12, ccy)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Mes más fuerte</h6>
            <div className="font-sans font-extrabold text-[23px]">{derived.topMonths[0]?.mes ?? "—"}</div>
            <div className="text-muted text-[11px] mt-0.5">{formatCurrency(derived.monthly[derived.best], ccy)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Pagos en el año</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatNumber(derived.events.length)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Pagado</h6>
            <div className="font-sans font-extrabold text-[23px]">{derived.totalY > 0 ? formatPercent((derived.pagadoSum / derived.totalY) * 100) : "—"}</div>
            <div className="text-muted text-[11px] mt-0.5">del total anual</div>
          </div>
        </div>

        {derived.events.length === 0 ? (
          <p className="text-muted text-sm py-10">
            Esta cartera no tiene posiciones con historial de dividendos todavía — agrega transacciones en el Panel.
          </p>
        ) : (
          <>
            <div className="mt-9">
              <div className="flex items-center gap-4 mb-2.5">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Flujo mensual de ingreso pasivo</h6>
                <span className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="inline-block w-2.5 h-2.5 bg-ink" />
                  Mes
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="inline-block w-2.5 h-2.5 bg-accent" />
                  Mes más fuerte
                </span>
              </div>
              <MonthlyBarChart data={derived.bars} />
            </div>

            <div className="flex flex-wrap gap-9 mt-[38px] items-start">
              <div className="flex-[2_1_560px] min-w-0">
                <h6 className="m-0 mb-3 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Calendario {CURRENT_YEAR}</h6>
                <CalendarGrid cells={derived.calCells} />
              </div>
              <div className="flex-[1_1_320px] min-w-0">
                <TopPayers payers={derived.topPay} months={derived.topMonths} />
              </div>
            </div>

            <div className="mt-10">
              <div className="flex items-center gap-3.5 mb-2.5 flex-wrap">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Detalle de pagos</h6>
                <SegmentedControl options={FILTER_OPTIONS} value={filtro} onChange={setFiltro} size="compact" />
                <span className="text-muted text-[11.5px] ml-auto">
                  {derived.detailRows.length} de {derived.events.length} pagos
                </span>
              </div>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Empresa</th>
                    <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Fecha</th>
                    <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Monto/acción</th>
                    <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Cantidad</th>
                    <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Total</th>
                    <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.detailRows.map((r, i) => (
                    <tr key={`${r.ticker}-${i}`}>
                      <td className="p-2 border-b border-divider">
                        <span className="font-mono font-bold text-xs">{r.ticker}</span>
                        <div className="text-muted text-[11px]">{r.nombre}</div>
                      </td>
                      <td className="p-2 border-b border-divider whitespace-nowrap">{r.fecha}</td>
                      <td className="p-2 border-b border-divider text-right">{r.montoLabel}</td>
                      <td className="p-2 border-b border-divider text-right">{r.cantidadLabel}</td>
                      <td className="p-2 border-b border-divider text-right font-bold">{r.totalLabel}</td>
                      <td className="p-2 border-b border-divider">
                        <Tag variant={r.estado === "Pagado" ? "neutral" : "outline"} className="text-[9.5px] px-1.5">
                          {r.estado}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <PageFooter moduleLabel="MÓDULO 4 · DIVIDENDOS" right="ir a Estrategias y objetivos (M5) →" />
      </PageContainer>
    </>
  );
}
