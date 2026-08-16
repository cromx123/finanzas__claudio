"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { Input } from "../../components/ui/Input";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { usePortfolios } from "../../context/Portfolios";
import { buildLedgerSummary } from "../../lib/calc/ledger";
import { valuateHoldings } from "../../lib/calc/portfolio";
import { formatCurrency, formatPercent } from "../../lib/format";
import { convertAmount } from "../../lib/mock/fx";
import type { Currency } from "../../lib/types";

const CURRENCY_OPTIONS: { label: string; value: Currency }[] = [
  { label: "CLP", value: "CLP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
];

export default function PerfilPage() {
  const { portfolios, getTransactions, getMetas, fxRates, setFxRate } = usePortfolios();
  const [displayCcy, setDisplayCcy] = useState<Currency>("CLP");

  const rows = useMemo(
    () =>
      portfolios.map((p) => {
        const ledger = buildLedgerSummary(getTransactions(p.id), getMetas(p.id));
        const valuation = valuateHoldings(ledger.holdings);
        const valorNativo = valuation.valorTotal;
        const valorConvertido = convertAmount(valorNativo, p.moneda, displayCcy, fxRates);
        return { portfolio: p, valorNativo, valorConvertido, activos: valuation.holdings.length };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolios, displayCcy, fxRates]
  );

  const total = rows.reduce((s, r) => s + r.valorConvertido, 0);

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{portfolios.length} portafolios</span>} />
      <PageContainer>
        <PageHeader kicker="PERFIL" title="Patrimonio combinado" aside="todos tus portafolios, convertidos a una sola moneda" />

        <div className="flex items-center gap-3 flex-wrap border-y-2 border-divider py-4 mb-8">
          <div>
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Ver en</h6>
            <SegmentedControl options={CURRENCY_OPTIONS} value={displayCcy} onChange={setDisplayCcy} />
          </div>
          <div className="ml-auto text-right">
            <h6 className="m-0 mb-1 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Patrimonio total</h6>
            <div className="font-sans font-extrabold text-[28px]">{formatCurrency(total, displayCcy, 0)}</div>
          </div>
        </div>

        {portfolios.length === 0 ? (
          <p className="text-muted text-sm py-6">Todavía no tienes portafolios — créalos desde el Panel.</p>
        ) : (
          <div>
            <h6 className="m-0 mb-3 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Por portafolio</h6>
            {rows
              .sort((a, b) => b.valorConvertido - a.valorConvertido)
              .map((r) => (
                <div key={r.portfolio.id} className="py-3 border-t border-divider">
                  <div className="flex items-baseline gap-2.5 text-[13px] mb-1.5">
                    <b>{r.portfolio.nombre}</b>
                    <span className="text-muted text-[11px]">
                      {r.portfolio.pais} · {r.portfolio.moneda} · {r.activos} activos
                    </span>
                    <span className="ml-auto">
                      <span className="text-muted">{formatCurrency(r.valorNativo, r.portfolio.moneda, 0)}</span>
                      {r.portfolio.moneda !== displayCcy ? (
                        <>
                          {" "}
                          → <b>{formatCurrency(r.valorConvertido, displayCcy, 0)}</b>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ProgressBar percent={total > 0 ? (r.valorConvertido / total) * 100 : 0} className="flex-1" />
                    <span className="text-xs flex-none w-12 text-right">{total > 0 ? formatPercent((r.valorConvertido / total) * 100) : "—"}</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="mt-11">
          <h6 className="m-0 mb-1 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Tipo de cambio</h6>
          <p className="text-muted text-[11.5px] mb-3">Cuántos CLP vale 1 unidad de cada moneda — ajústalo si difiere del real.</p>
          <div className="flex gap-6 flex-wrap">
            <Input
              label="1 USD = ? CLP"
              type="number"
              value={fxRates.USD}
              onChange={(e) => setFxRate("USD", parseFloat(e.target.value) || 0)}
              className="w-[140px]"
            />
            <Input
              label="1 EUR = ? CLP"
              type="number"
              value={fxRates.EUR}
              onChange={(e) => setFxRate("EUR", parseFloat(e.target.value) || 0)}
              className="w-[140px]"
            />
          </div>
        </div>

        <PageFooter moduleLabel="PERFIL" right={<>Conversión con el tipo de cambio de arriba · no es asesoría financiera</>} />
      </PageContainer>
    </>
  );
}
