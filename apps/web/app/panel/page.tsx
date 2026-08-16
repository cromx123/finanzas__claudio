"use client";

import { Pencil, Plus, History } from "lucide-react";
import { useMemo, useState } from "react";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { PerformanceChart } from "../../components/charts/PerformanceChart";
import { AddTransactionModal } from "../../components/panel/AddTransactionModal";
import { DistributionPanel } from "../../components/panel/DistributionPanel";
import { EditHoldingModal } from "../../components/panel/EditHoldingModal";
import { GoalsPanel } from "../../components/panel/GoalsPanel";
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
import { usePortfolios } from "../../context/Portfolios";
import { buildLedgerSummary, currentQuantity } from "../../lib/calc/ledger";
import { computeAllocation, makeGoalRow, sortHoldings, valuateHoldings } from "../../lib/calc/portfolio";
import { seedFromId } from "../../lib/calc/portfolioSeed";
import { buildPerformancePoints } from "../../lib/calc/series";
import { decimalesForCurrency, formatCurrency, formatDecimal, formatPercent } from "../../lib/format";
import { SP500_SERIE } from "../../lib/mock/portfolios";
import { generateSeries } from "../../lib/random";
import type { AllocBy, RangeKey } from "../../lib/types";

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

const MOCK_CHART_DRIFT = 0.012;
const MOCK_CHART_VOL = 0.045;

export default function PanelPage() {
  const {
    portfolios,
    activePortfolio,
    setActivePortfolioId,
    addPortfolio,
    updatePortfolio,
    deletePortfolio,
    getTransactions,
    addTransaction,
    deleteTransaction,
    getMetas,
    saveMeta,
    deletePosition,
    netoRetencion,
    toggleNetoRetencion,
  } = usePortfolios();

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
  const [editingTicker, setEditingTicker] = useState<string | null>(null);

  const portfolio = activePortfolio ?? portfolios[0] ?? null;
  const transactions = portfolio ? getTransactions(portfolio.id) : [];
  const metas = portfolio ? getMetas(portfolio.id) : {};

  const ledger = useMemo(() => buildLedgerSummary(transactions, metas), [transactions, metas]);
  const valuation = useMemo(() => valuateHoldings(ledger.holdings), [ledger]);
  const sortedHoldings = useMemo(() => sortHoldings(valuation.holdings, sortKey, sortDir), [valuation, sortKey, sortDir]);

  const perfPoints = useMemo(() => {
    if (!portfolio) return [];
    const full = generateSeries(seedFromId(portfolio.id), MOCK_CHART_DRIFT, MOCK_CHART_VOL);
    const fullBench = generateSeries(SP500_SERIE.seed, SP500_SERIE.drift, SP500_SERIE.vol);
    return buildPerformancePoints(full, fullBench, range);
  }, [portfolio, range]);

  if (portfolios.length === 0) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <PageHeader kicker="MÓDULO 1 · PANEL" title="Tus portafolios" />
          <div className="border-y-2 border-divider py-16 flex flex-col items-center gap-3 text-center">
            <p className="text-muted text-sm max-w-[420px]">
              Todavía no tienes portafolios. Crea el primero — nombre, país y moneda — para empezar a registrar tus compras y ventas.
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
            onSave={(input) => {
              addPortfolio(input);
              setShowAddPortfolio(false);
            }}
          />
        )}
      </>
    );
  }

  if (!portfolio) return null;

  const moneda = portfolio.moneda;
  const decimalesPrecio = decimalesForCurrency(moneda);

  const wh = netoRetencion ? portfolio.retencion : 0;
  const dividendoProyectado = valuation.dividendoProyectadoBruto * (1 - wh);
  const retornoTotal = ledger.aportes > 0 ? (valuation.valorTotal + ledger.gpRealizada - ledger.aportes) / ledger.aportes : 0;
  const subDivLabel = netoRetencion ? "neto de retención" : "bruto";

  const allocRows = computeAllocation(valuation.holdings, valuation.valorTotal, allocBy, moneda, 0);
  const goalRows = [
    makeGoalRow("Dividendo mensual", dividendoProyectado / 12, portfolio.objetivos.dividendoMensual, moneda, decimalesPrecio),
    makeGoalRow("Cobertura costo de vida", dividendoProyectado / 12, portfolio.objetivos.costoVida, moneda, decimalesPrecio),
    makeGoalRow("Próximo gran hito · patrimonio", valuation.valorTotal, portfolio.objetivos.hitoPatrimonio, moneda, 0),
  ];

  const kpis: KpiCell[] = [
    { label: "Valor total de la cartera", value: formatCurrency(valuation.valorTotal, moneda, 0), sub: "a precios marcados" },
    {
      label: "Rentabilidad total",
      value: formatPercent(retornoTotal * 100, true),
      sub: "incluye G/P realizada",
      colorClass: retornoTotal < 0 ? "text-accent-700" : undefined,
    },
    { label: "Aportes de capital", value: formatCurrency(ledger.aportes, moneda, 0), sub: "capital invertido en compras" },
    { label: "Compras totales", value: formatCurrency(ledger.comprasTotales, moneda, 0), sub: "acumulado histórico" },
    { label: "Dividendos cobrados", value: formatCurrency(0, moneda, 0), sub: `histórico, ${subDivLabel}` },
    {
      label: "G/P realizada",
      value: `${ledger.gpRealizada >= 0 ? "+" : ""}${formatCurrency(ledger.gpRealizada, moneda, 0)}`,
      sub: "ventas cerradas",
    },
    {
      label: "G/P no realizada",
      value: `${valuation.gpNoRealizada >= 0 ? "+" : ""}${formatCurrency(valuation.gpNoRealizada, moneda, 0)}`,
      sub: "valor − costo de posiciones abiertas",
      colorClass: valuation.gpNoRealizada < 0 ? "text-accent-700" : undefined,
    },
    {
      label: "Yield on Cost",
      value: valuation.costoTotal > 0 ? formatPercent((valuation.dividendoProyectadoBruto / valuation.costoTotal) * 100) : "—",
      sub: "dividendo anual ÷ costo, bruto",
    },
    { label: "Dividendo mensual", value: formatCurrency(dividendoProyectado / 12, moneda, decimalesPrecio), sub: `promedio 12m, ${subDivLabel}` },
    { label: "Dividendos proyectados", value: formatCurrency(dividendoProyectado, moneda, 0), sub: `próximos 12 meses, ${subDivLabel}` },
  ];

  const hoverPoint = hoverIndex !== null ? perfPoints[hoverIndex] : null;
  const editingMeta = editingTicker ? metas[editingTicker] : null;

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
                  {p.nombre}
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
          title={portfolio.nombre}
          aside={transactions.length > 0 ? `${transactions.length} transacciones registradas` : undefined}
        />

        {transactions.length === 0 ? (
          <div className="border-y-2 border-divider py-16 flex flex-col items-center gap-3 text-center">
            <p className="text-muted text-sm max-w-[420px]">
              Todavía no tienes transacciones en esta cartera. Agrega tu primera compra — ticker, fecha, monto invertido y precio por acción — para
              armar tu cartera.
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-11">
              <DistributionPanel rows={allocRows} allocBy={allocBy} onChange={setAllocBy} />
              <GoalsPanel rows={goalRows} />
              <UpcomingDividends rows={[]} subLabel={subDivLabel} />
            </div>

            <div className="mt-12">
              <div className="flex items-center gap-3 flex-wrap mb-2.5">
                <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Posiciones — {valuation.holdings.length} activos</h6>
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
              {valuation.holdings.length === 0 ? (
                <p className="text-muted text-sm py-6 border-t border-divider">
                  Vendiste todas tus posiciones — el historial de transacciones sigue disponible.
                </p>
              ) : (
                <HoldingsTable
                  holdings={sortedHoldings}
                  ccy={moneda}
                  decimales={0}
                  decimalesPrecio={decimalesPrecio}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={(key) => {
                    setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
                    setSortKey(key);
                  }}
                  onEdit={setEditingTicker}
                />
              )}
            </div>
          </>
        )}

        <PageFooter moduleLabel="MÓDULO 1 · PANEL" right={<>Datos ingresados manualmente · guardados en este navegador</>} />
      </PageContainer>

      {showAddModal && (
        <AddTransactionModal
          ccy={moneda}
          maxVenta={(ticker) => currentQuantity(transactions, ticker)}
          onClose={() => setShowAddModal(false)}
          onSubmit={(input) => {
            addTransaction(portfolio.id, input);
            setShowAddModal(false);
          }}
        />
      )}
      {showHistoryModal && (
        <TransactionHistoryModal
          transactions={transactions}
          ccy={moneda}
          decimalesPrecio={decimalesPrecio}
          onClose={() => setShowHistoryModal(false)}
          onDelete={(id) => deleteTransaction(portfolio.id, id)}
        />
      )}
      {editingMeta && (
        <EditHoldingModal
          meta={editingMeta}
          ccy={moneda}
          onClose={() => setEditingTicker(null)}
          onSave={(meta) => {
            saveMeta(portfolio.id, meta);
            setEditingTicker(null);
          }}
          onDeleteAll={() => {
            deletePosition(portfolio.id, editingMeta.ticker);
            setEditingTicker(null);
          }}
        />
      )}
      {showAddPortfolio && (
        <PortfolioFormModal
          onClose={() => setShowAddPortfolio(false)}
          onSave={(input) => {
            addPortfolio(input);
            setShowAddPortfolio(false);
          }}
        />
      )}
      {showEditPortfolio && (
        <PortfolioFormModal
          portfolio={portfolio}
          onClose={() => setShowEditPortfolio(false)}
          onSave={(input) => {
            updatePortfolio(portfolio.id, input);
            setShowEditPortfolio(false);
          }}
          onDelete={() => {
            deletePortfolio(portfolio.id);
            setShowEditPortfolio(false);
          }}
        />
      )}
    </>
  );
}
