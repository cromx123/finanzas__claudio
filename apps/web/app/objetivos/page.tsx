"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { FiLadder } from "../../components/objetivos/FiLadder";
import { GoalCards } from "../../components/objetivos/GoalCards";
import { TagAssignPanel } from "../../components/objetivos/TagAssignPanel";
import { TagTable } from "../../components/objetivos/TagTable";
import { Select } from "../../components/ui/Input";
import { usePortfolioUi } from "../../context/Portfolios";
import {
  useCreateTag,
  useGoals,
  useGoalsProgress,
  usePortfolios,
  usePortfolioSummary,
  useSetHoldingTags,
  useTags,
  useUpsertGoals,
} from "../../hooks/useApi";
import { buildFiSteps, buildGoalCards, buildTagRows } from "../../lib/calc/goals";
import { formatUsd } from "../../lib/format";
import type { Currency } from "../../lib/types";

const DISPLAY_CCY: Currency = "USD";

export default function ObjetivosPage() {
  const { activePortfolioId, setActivePortfolioId } = usePortfolioUi();
  const { data: portfolios } = usePortfolios();
  const portfolioId = portfolios?.find((p) => p.id === activePortfolioId)?.id ?? portfolios?.[0]?.id ?? null;
  const portfolio = portfolios?.find((p) => p.id === portfolioId) ?? null;

  const { data: progress } = useGoalsProgress(DISPLAY_CCY);
  const { data: goals } = useGoals();
  const upsertGoals = useUpsertGoals();

  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: allTags } = useTags();
  const createTag = useCreateTag();
  const setHoldingTagsMut = useSetHoldingTags(portfolioId ?? "");

  const [metaDivOverride, setMetaDivOverride] = useState<number | null>(null);
  const [gastoOverride, setGastoOverride] = useState<number | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const metaDiv = metaDivOverride ?? goals?.find((g) => g.kind === "monthly_dividends")?.target_amount ?? 300;
  const gasto = gastoOverride ?? goals?.find((g) => g.kind === "cost_coverage")?.monthly_expenses ?? 1800;

  const saveGoals = (nextMeta: number, nextGasto: number) => {
    upsertGoals.mutate([
      { kind: "monthly_dividends", target_amount: nextMeta, currency: DISPLAY_CCY },
      { kind: "cost_coverage", target_amount: nextGasto, currency: DISPLAY_CCY, monthly_expenses: nextGasto },
    ]);
  };

  const { goal1, goal2, goal3 } = useMemo(() => {
    if (!progress) return { goal1: null, goal2: null, goal3: null };
    const nextHito = progress.hitos_fi.find((h) => !h.logrado)?.monto ?? progress.numero_fi;
    return buildGoalCards(progress.dividendo_mensual, metaDiv, gasto, progress.patrimonio_total, nextHito);
  }, [progress, metaDiv, gasto]);

  const { steps, fiStep } = useMemo(() => {
    if (!progress) return { steps: [], fiStep: null };
    return buildFiSteps(progress.hitos_fi, progress.patrimonio_total, progress.numero_fi);
  }, [progress]);

  const tagRows = useMemo(() => {
    if (!summary || !portfolio) return [];
    return buildTagRows(summary.holdings, allTags ?? [], summary.valor_total, summary.dividendo_anual_bruto, portfolio.currency as Currency);
  }, [summary, portfolio, allTags]);

  const selectedHolding = summary?.holdings.find((h) => h.asset.yahoo_symbol === selectedSymbol) ?? summary?.holdings[0];

  if (!portfolios || portfolios.length === 0) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm py-10">Todavía no tienes portafolios — créalos desde el Panel.</p>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">todos tus portafolios · en {DISPLAY_CCY}</span>} />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 5 · ESTRATEGIAS Y OBJETIVOS"
          title="Tu cartera, por estrategia y meta"
          aside={
            progress ? (
              <>
                patrimonio combinado: <b className="text-ink">{formatUsd(progress.patrimonio_total)}</b> · ingreso pasivo:{" "}
                <b className="text-ink">{formatUsd(progress.dividendo_mensual, 2)}/mes</b>
              </>
            ) : undefined
          }
        />

        {!progress || !goal1 || !goal2 || !goal3 ? (
          <p className="text-muted text-sm py-10">Cargando…</p>
        ) : (
          <>
            <GoalCards
              goal1={goal1}
              goal2={goal2}
              goal3={goal3}
              metaDiv={metaDiv}
              onMetaDivChange={(v) => {
                setMetaDivOverride(v);
                saveGoals(v, gasto);
              }}
              gasto={gasto}
              onGastoChange={(v) => {
                setGastoOverride(v);
                saveGoals(metaDiv, v);
              }}
            />

            <div className="mt-10">
              <h6 className="m-0 mb-3.5 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Camino a la independencia financiera</h6>
              {fiStep ? <FiLadder steps={steps} fiStep={fiStep} /> : null}
            </div>
          </>
        )}

        <hr className="h-0.5 border-0 bg-divider mt-11 mb-0" />
        <div className="flex items-baseline gap-3.5 my-4 flex-wrap">
          <h6 className="m-0 text-xs uppercase tracking-[0.08em] font-sans font-extrabold">Estrategias por etiqueta</h6>
          <Select
            value={portfolioId ?? ""}
            onChange={(e) => setActivePortfolioId(e.target.value)}
            className="w-auto min-h-0 py-1 pr-6 text-xs"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <span className="text-muted text-[11.5px] ml-auto">un activo puede sumar a varias etiquetas</span>
        </div>

        {!summary || !portfolio ? (
          <p className="text-muted text-sm py-6">Cargando…</p>
        ) : summary.holdings.length === 0 ? (
          <p className="text-muted text-sm py-6">Este portafolio no tiene posiciones todavía.</p>
        ) : (
          <div className="flex flex-wrap gap-9 items-start">
            <div className="flex-[1.5_1_480px] min-w-0 overflow-x-auto">
              <TagTable rows={tagRows} onCreateTag={(label) => createTag.mutate(label)} />
            </div>
            <div className="flex-[1_1_330px] min-w-0">
              {selectedHolding ? (
                <TagAssignPanel
                  holdings={summary.holdings}
                  ccy={portfolio.currency as Currency}
                  tags={allTags ?? []}
                  selected={selectedHolding}
                  onSelect={setSelectedSymbol}
                  onToggleTag={(tag) => {
                    const current = selectedHolding.tags;
                    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
                    setHoldingTagsMut.mutate({ assetId: selectedHolding.asset.id, tags: next });
                  }}
                />
              ) : null}
            </div>
          </div>
        )}

        <PageFooter moduleLabel="MÓDULO 5 · ESTRATEGIAS Y OBJETIVOS" right="fin de la Fase 1 (asistente virtual excluido)" />
      </PageContainer>
    </>
  );
}
