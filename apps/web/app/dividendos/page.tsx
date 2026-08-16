"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { MonthlyBarChart } from "../../components/charts/MonthlyBarChart";
import { CalendarGrid } from "../../components/dividendos/CalendarGrid";
import { TopPayers } from "../../components/dividendos/TopPayers";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tag } from "../../components/ui/Tag";
import { usePortfolios } from "../../context/Portfolios";
import { useDividendCalendar } from "../../hooks/useApi";
import {
  bestMonthIndex,
  buildCalendarCells,
  buildDetailRows,
  buildDividendEvents,
  buildMonthlyBars,
  buildTopMonths,
  buildTopPayers,
  monthlyTotals,
} from "../../lib/calc/dividends";
import { formatCurrency, formatNumber, formatPercent } from "../../lib/format";
import type { DividendStatus } from "../../lib/types";

const FILTER_OPTIONS: { label: string; value: DividendStatus | "*" }[] = [
  { label: "Todos", value: "*" },
  { label: "Pagados", value: "Pagado" },
  { label: "Confirmados", value: "Confirmado" },
  { label: "Estimados", value: "Estimado" },
];

export default function DividendosPage() {
  const { netoRetencion, toggleNetoRetencion } = usePortfolios();
  const [portfolio, setPortfolio] = useState<"chile" | "global">("global");
  const { data: calendar } = useDividendCalendar(portfolio);
  const [filtro, setFiltro] = useState<DividendStatus | "*">("*");

  const derived = useMemo(() => {
    if (!calendar) return null;
    const wh = netoRetencion ? calendar.retencion : 0;
    const events = buildDividendEvents(calendar.activos, wh);
    const monthly = monthlyTotals(events);
    const best = bestMonthIndex(monthly);
    const totalY = monthly.reduce((s, v) => s + v, 0);
    const confSum = events.filter((e) => e.estado !== "Estimado").reduce((s, e) => s + e.total, 0);
    return {
      wh,
      events,
      monthly,
      best,
      totalY,
      confSum,
      bars: buildMonthlyBars(monthly, best, calendar.ccy),
      calCells: buildCalendarCells(events, monthly, best, calendar.ccy),
      topPay: buildTopPayers(events, totalY, calendar.ccy),
      topMonths: buildTopMonths(monthly, calendar.ccy),
      detailRows: buildDetailRows(events, filtro, calendar.ccy),
    };
  }, [calendar, netoRetencion, filtro]);

  if (!calendar || !derived) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const notaWh =
    portfolio === "global"
      ? netoRetencion
        ? "retención EE.UU. 30% aplicada · configurable por país y broker"
        : "montos brutos, sin retención"
      : "Chile: sin retención adicional en dividendos locales";

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
            <ToggleButton active={netoRetencion} onClick={toggleNetoRetencion} variant="ink">
              Neto de retención
            </ToggleButton>
          </>
        }
      />
      <PageContainer>
        <PageHeader kicker="MÓDULO 4 · CALENDARIO Y FLUJO DE CAJA" title={`Dividendos 2026 — ${calendar.nombre}`} aside={notaWh} />

        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y divide-divider border-y-2 border-divider">
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Total del año</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatCurrency(derived.totalY, calendar.ccy, 0)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Promedio mensual</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatCurrency(derived.totalY / 12, calendar.ccy, 0)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Mes más fuerte</h6>
            <div className="font-sans font-extrabold text-[23px]">{derived.topMonths[0]?.mes}</div>
            <div className="text-muted text-[11px] mt-0.5">{formatCurrency(derived.monthly[derived.best], calendar.ccy, 0)}</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Pagos en el año</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatNumber(derived.events.length)}</div>
            <div className="text-muted text-[11px] mt-0.5">{calendar.activos.length} activos pagadores</div>
          </div>
          <div className="px-[18px] py-4">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Pagado + confirmado</h6>
            <div className="font-sans font-extrabold text-[23px]">{formatPercent((derived.confSum / derived.totalY) * 100)}</div>
            <div className="text-muted text-[11px] mt-0.5">del total anual</div>
          </div>
        </div>

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
            <h6 className="m-0 mb-3 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Calendario 2026</h6>
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
                <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Fecha de pago</th>
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
                    <Tag variant={r.estado === "Pagado" ? "neutral" : r.estado === "Confirmado" ? "accent" : "outline"} className="text-[9.5px] px-1.5">
                      {r.estado}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PageFooter moduleLabel="MÓDULO 4 · DIVIDENDOS" right="ir a Estrategias y objetivos (M5) →" />
      </PageContainer>
    </>
  );
}
