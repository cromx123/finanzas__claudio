"use client";

import { useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { WorldMap } from "../../components/perfil/WorldMap";
import { Button } from "../../components/ui/Button";
import { HelpButton } from "../../components/ui/HelpButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useCountryAllocation, useFxRateDetails, useGoalsProgress, useRefreshFxRates } from "../../hooks/useApi";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Currency } from "../../lib/types";

const SOURCE_LABEL: Record<string, string> = {
  yahoo: "Yahoo Finance",
  manual: "ajustado a mano",
  default: "valor por defecto",
  base: "moneda base",
};

function formatAsOf(asOf: string | null): string {
  if (!asOf) return "";
  return new Date(`${asOf}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const CURRENCY_OPTIONS: { label: string; value: Currency }[] = [
  { label: "CLP", value: "CLP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
];

export default function PerfilPage() {
  const [displayCcy, setDisplayCcy] = useState<Currency>("CLP");
  const { data: progress } = useGoalsProgress(displayCcy);
  const { data: countryAllocation } = useCountryAllocation(displayCcy);
  const { data: fxDetails } = useFxRateDetails();
  const refreshFxRates = useRefreshFxRates();

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
              </ul>
              <p>Para ver el detalle de compras/ventas de cada portafolio, andá a Panel o Movimientos.</p>
            </HelpButton>
          }
        />

        <div className="flex items-center gap-3 flex-wrap border-y-2 border-divider py-4 mb-8">
          <div>
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Ver en</h6>
            <SegmentedControl options={CURRENCY_OPTIONS} value={displayCcy} onChange={setDisplayCcy} />
          </div>
          <div className="ml-auto text-right">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Patrimonio total</h6>
            <div className="font-sans font-extrabold text-[28px]">{formatCurrency(progress?.patrimonio_total ?? 0, displayCcy)}</div>
          </div>
        </div>

        {!progress || progress.portfolios.length === 0 ? (
          <p className="text-muted text-sm py-6">Todavía no tienes portafolios — créalos desde el Panel.</p>
        ) : (
          <div>
            <h6 className="m-0 mb-3 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Por portafolio</h6>
            {[...progress.portfolios]
              .sort((a, b) => b.valor_convertido - a.valor_convertido)
              .map((p) => (
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
                      className="flex-1"
                    />
                    <span className="text-xs flex-none w-12 text-right">
                      {progress.patrimonio_total > 0 ? formatPercent((p.valor_convertido / progress.patrimonio_total) * 100) : "—"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}

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
          <p className="text-muted text-[11.5px] mb-3">Cuántos CLP vale 1 unidad de cada moneda — obtenido del último cierre en Yahoo Finance.</p>
          <div className="flex gap-6 flex-wrap">
            {(["USD", "EUR"] as const).map((ccy) => {
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
                      {detail.as_of ? ` · ${formatAsOf(detail.as_of)}` : ""}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <PageFooter moduleLabel="PERFIL" right={<>Conversión con el tipo de cambio de arriba · no es asesoría financiera</>} />
      </PageContainer>
    </>
  );
}
