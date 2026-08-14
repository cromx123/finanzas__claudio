"use client";

import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { FiLadder } from "../../components/objetivos/FiLadder";
import { GoalCards } from "../../components/objetivos/GoalCards";
import { TagAssignPanel } from "../../components/objetivos/TagAssignPanel";
import { TagTable } from "../../components/objetivos/TagTable";
import { Tag } from "../../components/ui/Tag";
import { useGoalAssets, useTagAssignments, useTags } from "../../hooks/useApi";
import { buildFiLadder, buildGoalCards, buildTagRows, convertAssets } from "../../lib/calc/goals";
import { formatUsd } from "../../lib/format";
import { FI_HITOS, FX_CLP_USD_DEFAULT } from "../../lib/mock/goalsTags";

export default function ObjetivosPage() {
  const { data: goalAssets } = useGoalAssets();
  const { data: initialTags } = useTags();
  const { data: initialAssignments } = useTagAssignments();

  const [metaDiv, setMetaDiv] = useState(300);
  const [gasto, setGasto] = useState(1800);
  const [tags, setTags] = useState<string[] | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]> | null>(null);
  const [selectedTicker, setSelectedTicker] = useState("SCHD");

  const activeTags = useMemo(() => tags ?? initialTags ?? [], [tags, initialTags]);
  const activeAssignments = useMemo(() => assignments ?? initialAssignments ?? {}, [assignments, initialAssignments]);

  const derived = useMemo(() => {
    if (!goalAssets) return null;
    const converted = convertAssets(goalAssets, FX_CLP_USD_DEFAULT);
    const patrimonio = converted.reduce((s, a) => s + a.valorUsd, 0);
    const divAnual = converted.reduce((s, a) => s + a.dividendoUsdAnual, 0);
    const divMes = divAnual / 12;
    const { steps, fiStep, fiNum } = buildFiLadder(patrimonio, FI_HITOS, gasto);
    const next = FI_HITOS.find((h) => patrimonio < h) ?? fiNum;
    const { goal1, goal2, goal3 } = buildGoalCards(divMes, metaDiv, gasto, patrimonio, next);
    const tagRows = buildTagRows(converted, activeTags, activeAssignments, patrimonio, divAnual);
    return { converted, patrimonio, divMes, steps, fiStep, goal1, goal2, goal3, tagRows };
  }, [goalAssets, gasto, metaDiv, activeTags, activeAssignments]);

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

  const selectedAsset = derived.converted.find((a) => a.ticker === selectedTicker) ?? derived.converted[0];
  const assignedTags = activeAssignments[selectedAsset.ticker] ?? [];

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">ambas carteras · en US$ (fx CLP {FX_CLP_USD_DEFAULT})</span>} />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 5 · ESTRATEGIAS Y OBJETIVOS"
          title="Tu cartera, por estrategia y meta"
          aside={
            <>
              patrimonio combinado: <b className="text-ink">{formatUsd(derived.patrimonio)}</b> · ingreso pasivo:{" "}
              <b className="text-ink">{formatUsd(derived.divMes, 2)}/mes</b> neto
            </>
          }
        />

        <GoalCards
          goal1={derived.goal1}
          goal2={derived.goal2}
          goal3={derived.goal3}
          metaDiv={metaDiv}
          onMetaDivChange={setMetaDiv}
          gasto={gasto}
          onGastoChange={setGasto}
        />

        <div className="mt-10">
          <h6 className="m-0 mb-3.5 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Camino a la independencia financiera</h6>
          <FiLadder steps={derived.steps} fiStep={derived.fiStep} />
          <div className="flex gap-2 flex-wrap mt-[18px]">
            <Tag variant="neutral">Racha de aportes · 18 meses</Tag>
            <Tag variant="neutral">Dividendos cobrados · 12/12 meses</Tag>
            <Tag variant="outline">Mejor YoC · CHILE.SN 9,0%</Tag>
          </div>
        </div>

        <hr className="h-0.5 border-0 bg-divider mt-11 mb-0" />
        <div className="flex items-baseline gap-3.5 my-4">
          <h6 className="m-0 text-xs uppercase tracking-[0.08em] font-sans font-extrabold">Estrategias por etiqueta</h6>
          <span className="text-muted text-[11.5px] ml-auto">un activo puede sumar a varias etiquetas</span>
        </div>
        <div className="flex flex-wrap gap-9 items-start">
          <div className="flex-[1.5_1_480px] min-w-0 overflow-x-auto">
            <TagTable
              rows={derived.tagRows}
              onCreateTag={(name) => {
                if (!activeTags.includes(name)) setTags([...activeTags, name]);
              }}
            />
          </div>
          <div className="flex-[1_1_330px] min-w-0">
            <TagAssignPanel
              assets={derived.converted}
              tags={activeTags}
              selected={selectedAsset}
              onSelect={setSelectedTicker}
              assignedTags={assignedTags}
              onToggleTag={(tagName) => {
                const current = activeAssignments[selectedAsset.ticker] ?? [];
                const next = current.includes(tagName) ? current.filter((t) => t !== tagName) : [...current, tagName];
                setAssignments({ ...activeAssignments, [selectedAsset.ticker]: next });
              }}
            />
          </div>
        </div>

        <PageFooter moduleLabel="MÓDULO 5 · ESTRATEGIAS Y OBJETIVOS" right="fin de la Fase 1 (asistente virtual excluido)" />
      </PageContainer>
    </>
  );
}
