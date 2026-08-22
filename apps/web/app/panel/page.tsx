"use client";

import { Pencil, Plus, History, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { PerformanceChart } from "../../components/charts/PerformanceChart";
import { AddTransactionModal } from "../../components/panel/AddTransactionModal";
import { DistributionPanel } from "../../components/panel/DistributionPanel";
import { EditHoldingModal } from "../../components/panel/EditHoldingModal";
import { FinancialHealthCard } from "../../components/panel/FinancialHealthCard";
import { HoldingsTable, type HoldingsSortKey } from "../../components/panel/HoldingsTable";
import { KpiGrid, type KpiCell } from "../../components/panel/KpiGrid";
import { PortfolioFormModal } from "../../components/panel/PortfolioFormModal";
import { TransactionHistoryModal } from "../../components/panel/TransactionHistoryModal";
import { UpcomingDividends } from "../../components/panel/UpcomingDividends";
import { Button } from "../../components/ui/Button";
import { HelpButton } from "../../components/ui/HelpButton";
import { Select } from "../../components/ui/Input";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Tag } from "../../components/ui/Tag";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { usePortfolioUi } from "../../context/Portfolios";
import type { AllocationRow } from "../../lib/calc/portfolio";
import { buildPerformancePoints } from "../../lib/calc/series";
import { decimalesForCurrency, formatCurrency, formatDecimal, formatPercent } from "../../lib/format";
import type { AllocBy, Currency, RangeKey } from "../../lib/types";
import {
  useAddTransaction,
  useCreatePortfolio,
  useDeletePortfolio,
  useDeletePosition,
  useDeleteTransaction,
  useUpdateTransaction,
  useDividendCalendar,
  usePortfolioPerformance,
  usePortfolios,
  usePortfolioSummary,
  useRenamePortfolio,
  useTransactions,
} from "../../hooks/useApi";

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

const CURRENT_YEAR = new Date().getFullYear();

function PanelHelp() {
  return (
    <HelpButton title="Panel">
      <p>
        Cada portafolio tiene <b>una sola moneda</b> — creá uno por cada moneda en la que inviertas (ej: uno CLP, uno USD) y agregá
        transacciones de compra/venta con el ticker real (CHILE.SN, AAPL, IBE.MC).
      </p>
      <p>
        Los KPIs, la distribución y las posiciones se recalculan solos con precios reales de mercado. Para ver todo junto, convertido
        a una sola moneda, andá a <b>Perfil</b>.
      </p>
    </HelpButton>
  );
}

export default function PanelPage() {
  const { activePortfolioId, setActivePortfolioId, netoRetencion, toggleNetoRetencion } = usePortfolioUi();

  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();
  const portfolioId = portfolios?.find((p) => p.id === activePortfolioId)?.id ?? portfolios?.[0]?.id ?? null;
  const portfolio = portfolios?.find((p) => p.id === portfolioId) ?? null;

  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: transactions } = useTransactions(portfolioId);
  const { data: divCalendar } = useDividendCalendar(portfolioId, CURRENT_YEAR);

  const createPortfolio = useCreatePortfolio();
  const renamePortfolio = useRenamePortfolio();
  const deletePortfolioMut = useDeletePortfolio();
  const addTransaction = useAddTransaction(portfolioId ?? "");
  const deleteTransactionMut = useDeleteTransaction(portfolioId ?? "");
  const updateTransactionMut = useUpdateTransaction(portfolioId ?? "");
  const deletePositionMut = useDeletePosition(portfolioId ?? "");

  const [range, setRange] = useState<RangeKey>("3A");
  const [bench, setBench] = useState(true);
  const [allocBy, setAllocBy] = useState<AllocBy>("tipo");
  const [sortKey, setSortKey] = useState<HoldingsSortKey>("valor");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const {
    data: performance,
    isLoading: loadingPerformance,
    isFetching: fetchingPerformance,
    refetch: refetchPerformance,
  } = usePortfolioPerformance(portfolioId, range);
  const perfPoints = useMemo(
    () => (performance ? buildPerformancePoints(performance.points, range) : []),
    [performance, range]
  );

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
      const key = allocBy === "tipo" ? h.asset.type : allocBy === "sector" ? (h.asset.sector ?? "Sin sector") : h.asset.country;
      groups.set(key, (groups.get(key) ?? 0) + h.market_value);
    });
    return Array.from(groups.entries())
      .map(([label, value]) => ({
        label,
        value,
        pct: summary.valor_total > 0 ? value / summary.valor_total : 0,
        valueLabel: formatCurrency(value, ccy),
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
          <PageHeader kicker="MÓDULO 1 · PANEL" title="Tus portafolios" help={<PanelHelp />} />
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
  const decimalesPrecio = decimalesForCurrency();
  const dividendoAnual = netoRetencion ? summary.dividendo_anual_neto : summary.dividendo_anual_bruto;
  const retornoTotal = summary.aportes > 0 ? (summary.valor_total + summary.gp_realizada - summary.aportes) / summary.aportes : 0;
  const subDivLabel = netoRetencion ? "neto de retención" : "bruto";

  const kpis: KpiCell[] = [
    { label: "Valor total de la cartera", value: formatCurrency(summary.valor_total, moneda), sub: "a precios de mercado" },
    {
      label: "Rentabilidad total",
      value: formatPercent(retornoTotal * 100, true),
      sub: "incluye G/P realizada",
      colorClass: retornoTotal < 0 ? "text-accent-700" : undefined,
    },
    { label: "Aportes de capital", value: formatCurrency(summary.aportes, moneda), sub: "capital invertido en compras" },
    { label: "Compras totales", value: formatCurrency(summary.compras_totales, moneda), sub: "acumulado histórico" },
    {
      label: "Dividendos cobrados",
      value: formatCurrency(
        netoRetencion ? summary.dividendos_cobrados_neto : summary.dividendos_cobrados_bruto,
        moneda
      ),
      sub: `histórico, ${subDivLabel}`,
    },
    {
      label: "G/P realizada",
      value: `${summary.gp_realizada >= 0 ? "+" : ""}${formatCurrency(summary.gp_realizada, moneda)}`,
      sub: "ventas cerradas",
    },
    {
      label: "G/P no realizada",
      value: `${summary.gp_no_realizada >= 0 ? "+" : ""}${formatCurrency(summary.gp_no_realizada, moneda)}`,
      sub: "valor − costo de posiciones abiertas",
      colorClass: summary.gp_no_realizada < 0 ? "text-accent-700" : undefined,
    },
    {
      label: "Yield on Cost",
      value: summary.costo_total > 0 ? formatPercent((summary.dividendo_anual_bruto / summary.costo_total) * 100) : "—",
      sub: "dividendo anual ÷ costo, bruto",
    },
    { label: "Dividendo mensual", value: formatCurrency(dividendoAnual / 12, moneda, decimalesPrecio), sub: `promedio, ${subDivLabel}` },
    { label: "Dividendos proyectados", value: formatCurrency(dividendoAnual, moneda), sub: `próximos 12 meses, ${subDivLabel}` },
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
          help={<PanelHelp />}
        />

        <FinancialHealthCard />

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
                  {hoverPoint
                    ? `${hoverPoint.label} · Cartera ${formatDecimal(hoverPoint.cartera)} · S&P 500 ${
                        hoverPoint.benchmark !== null ? formatDecimal(hoverPoint.benchmark) : "—"
                      }`
                    : ""}
                </span>
                <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
                  <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} size="compact" />
                  <ToggleButton active={bench} onClick={() => setBench((v) => !v)} variant="ink">
                    VS S&amp;P 500
                  </ToggleButton>
                  <button
                    type="button"
                    onClick={() => refetchPerformance()}
                    disabled={fetchingPerformance}
                    aria-label="Actualizar gráfico"
                    title="Actualizar gráfico"
                    className="text-ink/50 hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={15} strokeWidth={1.8} className={fetchingPerformance ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              {loadingPerformance ? (
                <p className="text-muted text-sm py-16 text-center">Cargando historial…</p>
              ) : perfPoints.length === 0 ? (
                <p className="text-muted text-sm py-16 text-center">
                  Todavía no hay suficiente historial de precios para graficar la evolución.
                </p>
              ) : (
                <PerformanceChart data={perfPoints} benchmarkOn={bench} onHoverIndex={setHoverIndex} />
              )}
              <p className="text-muted text-[11px] mt-1.5">
                Valor real de la cartera desde tu primera compra ({performance?.start_date}) · S&amp;P 500 indexado para comparar — ambas
                líneas en base 100, no son directamente comparables en moneda.
              </p>
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
          portfolioId={portfolioId}
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
          onUpdate={async (id, input) => {
            await updateTransactionMut.mutateAsync({ transactionId: id, input });
          }}
          onDelete={(id) => deleteTransactionMut.mutate(id)}
        />
      )}
      {editingHolding && (
        <EditHoldingModal
          holding={editingHolding}
          onClose={() => setEditingAssetId(null)}
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
