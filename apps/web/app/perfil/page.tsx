"use client";

import { useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useFxRates, useGoalsProgress } from "../../hooks/useApi";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { Currency } from "../../lib/types";

const CURRENCY_OPTIONS: { label: string; value: Currency }[] = [
  { label: "CLP", value: "CLP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
];

export default function PerfilPage() {
  const [displayCcy, setDisplayCcy] = useState<Currency>("CLP");
  const { data: progress } = useGoalsProgress(displayCcy);
  const { data: fxRates } = useFxRates();

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{progress?.portfolios.length ?? 0} portafolios</span>} />
      <PageContainer>
        <PageHeader kicker="PERFIL" title="Patrimonio combinado" aside="todos tus portafolios, convertidos a una sola moneda" />

        <div className="flex items-center gap-3 flex-wrap border-y-2 border-divider py-4 mb-8">
          <div>
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Ver en</h6>
            <SegmentedControl options={CURRENCY_OPTIONS} value={displayCcy} onChange={setDisplayCcy} />
          </div>
          <div className="ml-auto text-right">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Patrimonio total</h6>
            <div className="font-sans font-extrabold text-[28px]">{formatCurrency(progress?.patrimonio_total ?? 0, displayCcy, 0)}</div>
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
                      <span className="text-muted">{formatCurrency(p.valor_nativo, p.currency as Currency, 0)}</span>
                      {p.currency !== displayCcy ? (
                        <>
                          {" "}
                          → <b>{formatCurrency(p.valor_convertido, displayCcy, 0)}</b>
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
          <h6 className="m-0 mb-1 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Tipo de cambio</h6>
          <p className="text-muted text-[11.5px] mb-3">
            Cuántos CLP vale 1 unidad de cada moneda — se obtiene automáticamente de Yahoo Finance cada vez que abres la app.
          </p>
          <div className="flex gap-6 flex-wrap">
            <div className="field">
              <span className="block text-xs mb-1 text-ink/70">1 USD = ? CLP</span>
              <div className="w-[140px] min-h-9 px-2.5 py-1.5 text-sm text-ink bg-ink/[0.04] border border-divider flex items-center">
                {fxRates ? formatCurrency(fxRates.USD, "CLP", 2) : "—"}
              </div>
            </div>
            <div className="field">
              <span className="block text-xs mb-1 text-ink/70">1 EUR = ? CLP</span>
              <div className="w-[140px] min-h-9 px-2.5 py-1.5 text-sm text-ink bg-ink/[0.04] border border-divider flex items-center">
                {fxRates ? formatCurrency(fxRates.EUR, "CLP", 2) : "—"}
              </div>
            </div>
          </div>
        </div>

        <PageFooter moduleLabel="PERFIL" right={<>Conversión con el tipo de cambio de Yahoo Finance · no es asesoría financiera</>} />
      </PageContainer>
    </>
  );
}
