"use client";

import { Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { AlertsPanel } from "../../components/perfil/AlertsPanel";
import { NetWorthChart } from "../../components/perfil/NetWorthChart";
import { WorldMap } from "../../components/perfil/WorldMap";
import { Button } from "../../components/ui/Button";
import { HelpButton } from "../../components/ui/HelpButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ToggleButton } from "../../components/ui/ToggleButton";
import {
  useAlerts,
  useCountryAllocation,
  useFxRateDetails,
  useGoalsProgress,
  useNetWorthHistory,
  useRefreshFxRates,
} from "../../hooks/useApi";
import { toCategoricalSegments } from "../../lib/calc/categoricalColors";
import { buildNetWorthPoints } from "../../lib/calc/networth";
import { exportAllDataJson } from "../../lib/export/backup";
import { formatCurrency, formatDateEs, formatPercent } from "../../lib/format";
import type { Currency, RangeKey } from "../../lib/types";

type PerfilTab = "resumen" | "alertas";

const TAB_OPTIONS: { label: string; value: PerfilTab }[] = [
  { label: "Resumen", value: "resumen" },
  { label: "Alertas", value: "alertas" },
];

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

const SOURCE_LABEL: Record<string, string> = {
  yahoo: "Yahoo Finance",
  manual: "ajustado a mano",
  default: "valor por defecto",
  base: "moneda base",
};

const CURRENCY_OPTIONS: { label: string; value: Currency }[] = [
  { label: "CLP", value: "CLP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "JPY", value: "JPY" },
];

export default function PerfilPage() {
  const [tab, setTab] = useState<PerfilTab>("resumen");
  const [displayCcy, setDisplayCcy] = useState<Currency>("CLP");
  const [multicolor, setMulticolor] = useState(false);
  const [netWorthRange, setNetWorthRange] = useState<RangeKey>("3A");
  const [netWorthHoverIndex, setNetWorthHoverIndex] = useState<number | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);
  const { data: progress } = useGoalsProgress(displayCcy);
  const { data: countryAllocation } = useCountryAllocation(displayCcy);
  const { data: fxDetails } = useFxRateDetails();
  const { data: alerts, isLoading: loadingAlerts } = useAlerts();
  const {
    data: netWorthHistory,
    isLoading: loadingNetWorth,
    isFetching: fetchingNetWorth,
    refetch: refetchNetWorth,
  } = useNetWorthHistory(displayCcy, netWorthRange);
  const refreshFxRates = useRefreshFxRates();

  const netWorthPoints = useMemo(
    () => (netWorthHistory ? buildNetWorthPoints(netWorthHistory.points, netWorthRange) : []),
    [netWorthHistory, netWorthRange]
  );
  const netWorthHoverPoint = netWorthHoverIndex !== null ? netWorthPoints[netWorthHoverIndex] : null;

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{progress?.portfolios.length ?? 0} portafolios</span>} />
      <PageContainer>
        <PageHeader
          kicker="PERFIL"
          title="Patrimonio combinado"
          aside="todos tus portafolios, convertidos a una sola moneda"
          help={
            <HelpButton title="Perfil">
              <p>
                Junta <b>todos tus portafolios</b> — sin importar su moneda — convertidos a una sola, con el tipo de cambio que ves
                abajo (auto-actualizado desde Yahoo Finance).
              </p>
              <ul>
                <li>El mapa muestra en qué países está invertido tu patrimonio.</li>
                <li>“Por portafolio” desglosa cuánto aporta cada uno al total.</li>
                <li>La pestaña “Alertas” es un seguimiento de precio, aparte de tus portafolios.</li>
              </ul>
              <p>Para ver el detalle de compras/ventas de cada portafolio, andá a Panel o Movimientos.</p>
            </HelpButton>
          }
        />

        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} className="mb-8" />

        {tab === "alertas" ? (
          <AlertsPanel alerts={alerts ?? []} isLoading={loadingAlerts} />
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap border-y-2 border-divider py-4 mb-8">
              <div>
                <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Ver en</h6>
                <SegmentedControl options={CURRENCY_OPTIONS} value={displayCcy} onChange={setDisplayCcy} />
              </div>
              <div className="ml-auto text-right">
                <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">
                  Patrimonio total
                </h6>
                <div className="font-sans font-extrabold text-[28px]">{formatCurrency(progress?.patrimonio_total ?? 0, displayCcy)}</div>
              </div>
            </div>

            {!progress || progress.portfolios.length === 0 ? (
              <p className="text-muted text-sm py-6">Todavía no tienes portafolios — créalos desde el Panel.</p>
            ) : (
              <div>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Por portafolio</h6>
                  <ToggleButton active={multicolor} onClick={() => setMulticolor((v) => !v)} variant="ink" className="ml-auto">
                    Multicolor
                  </ToggleButton>
                </div>
                {[...progress.portfolios]
                  .sort((a, b) => b.valor_convertido - a.valor_convertido)
                  .map((p) => {
                    const segments = multicolor
                      ? toCategoricalSegments(
                          p.holdings,
                          (h) => h.yahoo_symbol,
                          (h) => h.valor_nativo
                        ).map((s) => ({ ...s, value: p.valor_nativo > 0 ? (s.value / p.valor_nativo) * 100 : 0 }))
                      : null;

                    return (
                      <div key={p.id} className="py-3 border-t border-divider">
                        <div className="flex items-baseline gap-2.5 text-[13px] mb-1.5">
                          <b>{p.name}</b>
                          <span className="text-muted text-[11px]">{p.currency}</span>
                          <span className="ml-auto">
                            <span className="text-muted">{formatCurrency(p.valor_nativo, p.currency as Currency)}</span>
                            {p.currency !== displayCcy ? (
                              <>
                                {" "}
                                → <b>{formatCurrency(p.valor_convertido, displayCcy)}</b>
                              </>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <ProgressBar
                            percent={progress.patrimonio_total > 0 ? (p.valor_convertido / progress.patrimonio_total) * 100 : 0}
                            segments={segments ?? undefined}
                            className="flex-1"
                          />
                          <span className="text-xs flex-none w-12 text-right">
                            {progress.patrimonio_total > 0 ? formatPercent((p.valor_convertido / progress.patrimonio_total) * 100) : "—"}
                          </span>
                        </div>
                        {segments && segments.length > 0 ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                            {segments.map((s) => (
                              <span key={s.label} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
                                <span className="inline-block w-2 h-2 flex-none" style={{ background: s.color }} />
                                {s.label} · {formatPercent(s.value)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="mt-11">
              <div className="flex items-center gap-[18px] flex-wrap mb-3.5">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Patrimonio en el tiempo</h6>
                <span className="text-muted text-[11.5px] font-mono">
                  {netWorthHoverPoint ? `${netWorthHoverPoint.label} · ${formatCurrency(netWorthHoverPoint.value, displayCcy)}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
                  <SegmentedControl options={RANGE_OPTIONS} value={netWorthRange} onChange={setNetWorthRange} size="compact" />
                  <button
                    type="button"
                    onClick={() => refetchNetWorth()}
                    disabled={fetchingNetWorth}
                    aria-label="Actualizar gráfico"
                    title="Actualizar gráfico"
                    className="text-ink/50 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={15} strokeWidth={1.8} className={fetchingNetWorth ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              {loadingNetWorth ? (
                <p className="text-muted text-sm py-16 text-center">Cargando historial…</p>
              ) : netWorthPoints.length === 0 ? (
                <p className="text-muted text-sm py-16 text-center">
                  Todavía no hay suficiente historial de precios para graficar el patrimonio combinado.
                </p>
              ) : (
                <NetWorthChart data={netWorthPoints} onHoverIndex={setNetWorthHoverIndex} />
              )}
              <p className="text-muted text-[11px] mt-1.5">
                Valor real combinado de todos tus portafolios desde tu primera compra ({netWorthHistory?.start_date}) — cada punto
                convertido con el tipo de cambio vigente en esa fecha, no el de hoy.
              </p>
            </div>

            <div className="mt-11">
              <h6 className="m-0 mb-1 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Distribución geográfica</h6>
              <p className="text-muted text-[11.5px] mb-3">Suma de holdings de todos tus portafolios, por país del activo.</p>
              <WorldMap rows={countryAllocation?.rows ?? []} currency={displayCcy} />
            </div>

            <div className="mt-11">
              <div className="flex items-baseline gap-3 mb-1">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Tipo de cambio</h6>
                <Button
                  variant="secondary"
                  className="text-xs ml-auto"
                  onClick={() => refreshFxRates.mutate()}
                  disabled={refreshFxRates.isPending}
                >
                  {refreshFxRates.isPending ? "Actualizando…" : "Actualizar desde Yahoo Finance"}
                </Button>
              </div>
              <p className="text-muted text-[11.5px] mb-3">
                Cuántos CLP vale 1 unidad de cada moneda — obtenido del último cierre en Yahoo Finance.
              </p>
              <div className="flex gap-6 flex-wrap">
                {(["USD", "EUR", "JPY"] as const).map((ccy) => {
                  const detail = fxDetails?.[ccy];
                  return (
                    <div key={ccy} className="w-[160px]">
                      <div className="text-xs mb-1 text-ink/70">1 {ccy} = ? CLP</div>
                      <div className="min-h-9 px-2.5 py-1.5 text-sm bg-surface border border-divider">
                        {detail ? formatCurrency(detail.rate, "CLP") : "—"}
                      </div>
                      {detail ? (
                        <div className="text-muted text-[10.5px] mt-1">
                          {SOURCE_LABEL[detail.source] ?? detail.source}
                          {detail.as_of ? ` · ${formatDateEs(detail.as_of)}` : ""}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-11">
              <div className="flex items-baseline gap-3 mb-1">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Respaldo de datos</h6>
                <Button
                  variant="secondary"
                  className="text-xs ml-auto"
                  disabled={exportingBackup}
                  onClick={async () => {
                    setExportingBackup(true);
                    try {
                      await exportAllDataJson();
                    } finally {
                      setExportingBackup(false);
                    }
                  }}
                >
                  <Download size={14} strokeWidth={1.8} />
                  {exportingBackup ? "Generando…" : "Exportar todos mis datos"}
                </Button>
              </div>
              <p className="text-muted text-[11.5px]">
                Descarga un JSON con todos tus portafolios, transacciones, metas, alertas y etiquetas — un respaldo manual, útil
                para migrar o simplemente tener tus propios datos guardados.
              </p>
            </div>
          </>
        )}

        <PageFooter moduleLabel="PERFIL" right={<>Conversión con el tipo de cambio de Yahoo Finance · no es asesoría financiera</>} />
      </PageContainer>
    </>
  );
}
