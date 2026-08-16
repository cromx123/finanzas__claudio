"use client";

import { Pencil, Plus, History } from "lucide-react";
import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { PerformanceChart } from "../../components/charts/PerformanceChart";
import { AddTransactionModal } from "../../components/panel/AddTransactionModal";
import { DistributionPanel } from "../../components/panel/DistributionPanel";
import { EditHoldingModal } from "../../components/panel/EditHoldingModal";
import { HoldingsTable, type HoldingsSortKey } from "../../components/panel/HoldingsTable";
import { KpiGrid, type KpiCell } from "../../components/panel/KpiGrid";
import { PortfolioFormModal } from "../../components/panel/PortfolioFormModal";
import { TransactionHistoryModal } from "../../components/panel/TransactionHistoryModal";
import { UpcomingDividends } from "../../components/panel/UpcomingDividends";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Tag } from "../../components/ui/Tag";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { usePortfolioUi } from "../../context/Portfolios";
import type { AllocationRow } from "../../lib/calc/portfolio";
import { seedFromId } from "../../lib/calc/portfolioSeed";
import { buildPerformancePoints } from "../../lib/calc/series";
import { decimalesForCurrency, formatCurrency, formatDecimal, formatPercent } from "../../lib/format";
import { SP500_SERIE } from "../../lib/mock/portfolios";
import { generateSeries } from "../../lib/random";
import type { AllocBy, Currency, RangeKey } from "../../lib/types";
import {
  useAddTransaction,
  useCreatePortfolio,
  useCreateTag,
  useDeletePortfolio,
  useDeletePosition,
  useDeleteTransaction,
  useDividendCalendar,
  usePortfolios,
  usePortfolioSummary,
  useRenamePortfolio,
  useSetHoldingTags,
  useTags,
  useTransactions,
} from "../../hooks/useApi";

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

const MOCK_CHART_DRIFT = 0.012;
const MOCK_CHART_VOL = 0.045;
const CURRENT_YEAR = new Date().getFullYear();

export default function PanelPage() {
  const { activePortfolioId, setActivePortfolioId, netoRetencion, toggleNetoRetencion } = usePortfolioUi();

  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioId = portfolios?.find((p) => p.id === activePortfolioId)?.id ?? portfolios?.[0]?.id ?? null;
  const portfolio = portfolios?.find((p) => p.id === portfolioId) ?? null;

  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: transactions } = useTransactions(portfolioId);
  const { data: allTags } = useTags();
  const { data: divCalendar } = useDividendCalendar(portfolioId, CURRENT_YEAR);

  const createPortfolio = useCreatePortfolio();
  const renamePortfolio = useRenamePortfolio();
  const deletePortfolioMut = useDeletePortfolio();
  const addTransaction = useAddTransaction(portfolioId ?? "");
  const deleteTransactionMut = useDeleteTransaction(portfolioId ?? "");
  const deletePositionMut = useDeletePosition(portfolioId ?? "");
  const setHoldingTagsMut = useSetHoldingTags(portfolioId ?? "");
  const createTag = useCreateTag();

  const [range, setRange] = useState<RangeKey>("3A");
  const [bench, setBench] = useState(true);
  const [allocBy, setAllocBy] = useState<AllocBy>("tag");
  const [sortKey, setSortKey] = useState<HoldingsSortKey>("valor");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const perfPoints = useMemo(() => {
    if (!portfolioId) return [];
    const full = generateSeries(seedFromId(portfolioId), MOCK_CHART_DRIFT, MOCK_CHART_VOL);
    const fullBench = generateSeries(SP500_SERIE.seed, SP500_SERIE.drift, SP500_SERIE.vol);
    return buildPerformancePoints(full, fullBench, range);
  }, [portfolioId, range]);

  const sortedHoldings = useMemo(() => {
    if (!summary) return [];
    const key = sortKey === "valor" ? "market_value" : sortKey === "yoc" ? "yield_on_cost" : "unrealized_pl";
    return [...summary.holdings].sort((a, b) => sortDir * (a[key] - b[key]));
  }, [summary, sortKey, sortDir]);

  const allocRows: AllocationRow[] = useMemo(() => {
    if (!summary || !portfolio) return [];
    const ccy = portfolio.currency as Currency;
    const groups = new Map<string, number>();
    summary.holdings.forEach((h) => {
      let keys: string[];
      if (allocBy === "tipo") keys = [h.asset.type];
      else if (allocBy === "sector") keys = [h.asset.sector ?? "Sin sector"];
      else if (allocBy === "pais") keys = [h.asset.country];
      else keys = h.tags.length ? h.tags : ["Sin etiqueta"];
      keys.forEach((k) => groups.set(k, (groups.get(k) ?? 0) + h.market_value));
    });
    return Array.from(groups.entries())
      .map(([label, value]) => ({
        label,
        value,
        pct: summary.valor_total > 0 ? value / summary.valor_total : 0,
        valueLabel: formatCurrency(value, ccy, 0),
        pctLabel: formatPercent(summary.valor_total > 0 ? (value / summary.valor_total) * 100 : 0),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [summary, portfolio, allocBy]);

  const upcomingRows = useMemo(() => {
    if (!divCalendar || !portfolio) return [];
    const ccy = portfolio.currency as Currency;
    const today = new Date().toISOString().slice(0, 10);
    return divCalendar.events
      .filter((e) => e.ex_date >= today)
      .slice(0, 4)
      .map((e) => ({
        ticker: e.yahoo_symbol,
        fecha: e.ex_date,
        estado: e.estado === "Pagado" ? ("Confirmado" as const) : ("Estimado" as const),
        montoLabel: formatCurrency(netoRetencion ? e.total_neto : e.total_bruto, ccy),
      }));
  }, [divCalendar, portfolio, netoRetencion]);

  if (loadingPortfolios) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <PageHeader kicker="MÓDULO 1 · PANEL" title="Tus portafolios" />
          <div className="border-y-2 border-divider py-16 flex flex-col items-center gap-3 text-center">
            <p className="text-muted text-sm max-w-[420px]">
              Todavía no tienes portafolios. Crea el primero — nombre y moneda — para empezar a registrar tus compras y ventas.
            </p>
            <Button variant="primary" onClick={() => setShowAddPortfolio(true)}>
              <Plus size={16} strokeWidth={2} />
              Nuevo portafolio
            </Button>
          </div>
        </PageContainer>
        {showAddPortfolio && (
          <PortfolioFormModal
            onClose={() => setShowAddPortfolio(false)}
            onSave={async (input) => {
              await createPortfolio.mutateAsync(input);
              setShowAddPortfolio(false);
            }}
          />
        )}
      </>
    );
  }

  if (!portfolio || !summary) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const moneda = portfolio.currency as Currency;
  const decimalesPrecio = decimalesForCurrency(moneda);
  const dividendoAnual = netoRetencion ? summary.dividendo_anual_neto : summary.dividendo_anual_bruto;
  const retornoTotal = summary.aportes > 0 ? (summary.valor_total + summary.gp_realizada - summary.aportes) / summary.aportes : 0;
  const subDivLabel = netoRetencion ? "neto de retención" : "bruto";

  const kpis: KpiCell[] = [
    { label: "Valor total de la cartera", value: formatCurrency(summary.valor_total, moneda, 0), sub: "a precios de mercado" },
    {
      label: "Rentabilidad total",
      value: formatPercent(retornoTotal * 100, true),
      sub: "incluye G/P realizada",
      colorClass: retornoTotal < 0 ? "text-accent-700" : undefined,
    },
    { label: "Aportes de capital", value: formatCurrency(summary.aportes, moneda, 0), sub: "capital invertido en compras" },
    { label: "Compras totales", value: formatCurrency(summary.compras_totales, moneda, 0), sub: "acumulado histórico" },
    { label: "Dividendos cobrados", value: formatCurrency(0, moneda, 0), sub: `histórico, ${subDivLabel}` },
    {
      label: "G/P realizada",
      value: `${summary.gp_realizada >= 0 ? "+" : ""}${formatCurrency(summary.gp_realizada, moneda, 0)}`,
      sub: "ventas cerradas",
    },
    {
      label: "G/P no realizada",
      value: `${summary.gp_no_realizada >= 0 ? "+" : ""}${formatCurrency(summary.gp_no_realizada, moneda, 0)}`,
      sub: "valor − costo de posiciones abiertas",
      colorClass: summary.gp_no_realizada < 0 ? "text-accent-700" : undefined,
    },
    {
      label: "Yield on Cost",
      value: summary.costo_total > 0 ? formatPercent((summary.dividendo_anual_bruto / summary.costo_total) * 100) : "—",
      sub: "dividendo anual ÷ costo, bruto",
    },
    { label: "Dividendo mensual", value: formatCurrency(dividendoAnual / 12, moneda, decimalesPrecio), sub: `promedio, ${subDivLabel}` },
    { label: "Dividendos proyectados", value: formatCurrency(dividendoAnual, moneda, 0), sub: `próximos 12 meses, ${subDivLabel}` },
  ];

  const hoverPoint = hoverIndex !== null ? perfPoints[hoverIndex] : null;
  const editingHolding = editingAssetId ? summary.holdings.find((h) => h.asset.id === editingAssetId) : null;
  const hasTransactions = (transactions?.length ?? 0) > 0;

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
            <button
              type="button"
              onClick={() => setShowEditPortfolio(true)}
              aria-label="Editar portafolio"
              className="text-ink/50 hover:text-accent cursor-pointer"
            >
              <Pencil size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddPortfolio(true)}
              aria-label="Nuevo portafolio"
              className="text-ink/50 hover:text-accent cursor-pointer"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
            <Tag variant="outline">{moneda}</Tag>
            <ToggleButton active={netoRetencion} onClick={toggleNetoRetencion} variant="accent">
              Neto de retención
            </ToggleButton>
          </>
        }
      />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 1 · PANEL"
          title={portfolio.name}
          aside={hasTransactions ? `${transactions!.length} transacciones registradas` : undefined}
        />

        {!hasTransactions ? (
          <div className="border-y-2 border-divider py-16 flex flex-col items-center gap-3 text-center">
            <p className="text-muted text-sm max-w-[420px]">
              Todavía no tienes transacciones en esta cartera. Agrega tu primera compra — ticker real (ej: CHILE.SN, AAPL, SCHD), fecha, monto
              invertido y precio por acción — para armar tu cartera.
            </p>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} strokeWidth={2} />
              Agregar transacción
            </Button>
          </div>
        ) : (
          <>
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
              <p className="text-muted text-[11px] mt-1.5">Serie ilustrativa — todavía no ingestamos histórico real de valor de cartera.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-11">
              <DistributionPanel rows={allocRows} allocBy={allocBy} onChange={setAllocBy} />
              <UpcomingDividends rows={upcomingRows} subLabel={subDivLabel} />
            </div>

            <div className="mt-12">
              <div className="flex items-center gap-3 flex-wrap mb-2.5">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Posiciones — {summary.holdings.length} activos</h6>
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={() => setShowHistoryModal(true)} className="text-xs">
                    <History size={14} strokeWidth={1.8} />
                    Historial
                  </Button>
                  <Button variant="primary" onClick={() => setShowAddModal(true)} className="text-xs">
                    <Plus size={14} strokeWidth={2} />
                    Agregar transacción
                  </Button>
                </div>
              </div>
              {summary.holdings.length === 0 ? (
                <p className="text-muted text-sm py-6 border-t border-divider">
                  Vendiste todas tus posiciones — el historial de transacciones sigue disponible.
                </p>
              ) : (
                <HoldingsTable
                  holdings={sortedHoldings}
                  valorTotal={summary.valor_total}
                  ccy={moneda}
                  decimalesPrecio={decimalesPrecio}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(key) => {
                    setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
                    setSortKey(key);
                  }}
                  onEdit={setEditingAssetId}
                />
              )}
            </div>
          </>
        )}

        <PageFooter moduleLabel="MÓDULO 1 · PANEL" right={<>Datos reales · precios y fundamentales desde yfinance</>} />
      </PageContainer>

      {showAddModal && portfolioId && (
        <AddTransactionModal
          ccy={moneda}
          maxVenta={(symbol) =>
            summary.holdings.find((h) => h.asset.yahoo_symbol === symbol.toUpperCase())?.quantity ?? 0
          }
          onClose={() => setShowAddModal(false)}
          onSubmit={async (input) => {
            await addTransaction.mutateAsync(input);
            setShowAddModal(false);
          }}
        />
      )}
      {showHistoryModal && (
        <TransactionHistoryModal
          transactions={transactions ?? []}
          ccy={moneda}
          decimalesPrecio={decimalesPrecio}
          onClose={() => setShowHistoryModal(false)}
          onDelete={(id) => deleteTransactionMut.mutate(id)}
        />
      )}
      {editingHolding && (
        <EditHoldingModal
          holding={editingHolding}
          allTags={allTags ?? []}
          onClose={() => setEditingAssetId(null)}
          onToggleTag={(tag) => {
            const current = editingHolding.tags;
            const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
            setHoldingTagsMut.mutate({ assetId: editingHolding.asset.id, tags: next });
          }}
          onCreateTag={(label) => createTag.mutate(label)}
          onDeleteAll={() => {
            deletePositionMut.mutate(editingHolding.asset.id);
            setEditingAssetId(null);
          }}
        />
      )}
      {showAddPortfolio && (
        <PortfolioFormModal
          onClose={() => setShowAddPortfolio(false)}
          onSave={async (input) => {
            const created = await createPortfolio.mutateAsync(input);
            setActivePortfolioId(created.id);
            setShowAddPortfolio(false);
          }}
        />
      )}
      {showEditPortfolio && (
        <PortfolioFormModal
          portfolio={portfolio}
          onClose={() => setShowEditPortfolio(false)}
          onSave={async (input) => {
            await renamePortfolio.mutateAsync({ id: portfolio.id, name: input.name });
            setShowEditPortfolio(false);
          }}
          onDelete={async () => {
            await deletePortfolioMut.mutateAsync(portfolio.id);
            setActivePortfolioId(null);
            setShowEditPortfolio(false);
          }}
        />
      )}
    </>
  );
}
