"use client";

import { Plus, History } from "lucide-react";
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
import { TransactionHistoryModal } from "../../components/panel/TransactionHistoryModal";
import { UpcomingDividends } from "../../components/panel/UpcomingDividends";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Tag } from "../../components/ui/Tag";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { usePortfolioPreferences } from "../../context/PortfolioPreferences";
import { usePerformanceInputs, usePortfolio } from "../../hooks/useApi";
import { buildLedgerSummary, currentQuantity, inferPaisFromTicker, nextId } from "../../lib/calc/ledger";
import { computeAllocation, makeGoalRow, sortHoldings, valuateHoldings } from "../../lib/calc/portfolio";
import { buildPerformancePoints } from "../../lib/calc/series";
import { decimalesForCurrency, formatCurrency, formatDecimal, formatPercent } from "../../lib/format";
import { generateSeries } from "../../lib/random";
import { useLocalStorageJSON } from "../../lib/storage";
import type { AllocBy, Currency, HoldingMeta, RangeKey, Transaction, TransactionType } from "../../lib/types";

const CURRENCY_OPTIONS: { label: string; value: Currency }[] = [
  { label: "CLP", value: "CLP" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
];

const RANGE_OPTIONS: { label: string; value: RangeKey }[] = [
  { label: "1A", value: "1A" },
  { label: "3A", value: "3A" },
  { label: "5A", value: "5A" },
];

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_METAS: Record<string, HoldingMeta> = {};

export default function PanelPage() {
  const { portfolio, setPortfolio, netoRetencion, toggleNetoRetencion } = usePortfolioPreferences();
  const { data: port } = usePortfolio(portfolio);
  const { data: perfInputs } = usePerformanceInputs(portfolio);

  const [transactions, setTransactions] = useLocalStorageJSON<Transaction[]>(`inversiones-3.0:tx:${portfolio}`, EMPTY_TRANSACTIONS);
  const [metas, setMetas] = useLocalStorageJSON<Record<string, HoldingMeta>>(`inversiones-3.0:meta:${portfolio}`, EMPTY_METAS);
  const [monedaOverride, setMonedaOverride] = useLocalStorageJSON<Currency | null>(`inversiones-3.0:moneda:${portfolio}`, null);

  const [range, setRange] = useState<RangeKey>("3A");
  const [bench, setBench] = useState(true);
  const [allocBy, setAllocBy] = useState<AllocBy>("tag");
  const [sortKey, setSortKey] = useState<HoldingsSortKey>("valor");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);

  const ledger = useMemo(() => buildLedgerSummary(transactions, metas), [transactions, metas]);
  const valuation = useMemo(() => valuateHoldings(ledger.holdings), [ledger]);
  const sortedHoldings = useMemo(() => sortHoldings(valuation.holdings, sortKey, sortDir), [valuation, sortKey, sortDir]);

  const perfPoints = useMemo(() => {
    if (!perfInputs) return [];
    const full = generateSeries(perfInputs.seed, perfInputs.drift, perfInputs.vol);
    const fullBench = generateSeries(perfInputs.benchmark.seed, perfInputs.benchmark.drift, perfInputs.benchmark.vol);
    return buildPerformancePoints(full, fullBench, range);
  }, [perfInputs, range]);

  if (!port) {
    return (
      <>
        <NavBar />
        <PageContainer>
          <p className="text-muted text-sm">Cargando…</p>
        </PageContainer>
      </>
    );
  }

  const moneda: Currency = monedaOverride ?? port.moneda;
  const decimalesPrecio = decimalesForCurrency(moneda);

  const handleAddTransaction = (input: { ticker: string; tipo: TransactionType; fecha: string; monto: number; precio: number }) => {
    const tx: Transaction = { id: nextId(), ...input, cantidad: input.monto / input.precio };
    setTransactions([...transactions, tx]);
    if (!metas[input.ticker]) {
      const meta: HoldingMeta = {
        ticker: input.ticker,
        nombre: input.ticker,
        tipo: "Acción",
        tag: "Sin etiqueta",
        sector: "Sin sector",
        pais: inferPaisFromTicker(input.ticker),
        precioActual: input.precio,
        dividendoAnualPorAccion: 0,
      };
      setMetas({ ...metas, [input.ticker]: meta });
    }
    setShowAddModal(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const handleSaveMeta = (meta: HoldingMeta) => {
    setMetas({ ...metas, [meta.ticker]: meta });
    setEditingTicker(null);
  };

  const handleDeletePosition = (ticker: string) => {
    setTransactions(transactions.filter((t) => t.ticker !== ticker));
    const nextMetas = { ...metas };
    delete nextMetas[ticker];
    setMetas(nextMetas);
    setEditingTicker(null);
  };

  const wh = netoRetencion ? port.retencion : 0;
  const dividendoProyectado = valuation.dividendoProyectadoBruto * (1 - wh);
  const retornoTotal = ledger.aportes > 0 ? (valuation.valorTotal + ledger.gpRealizada - ledger.aportes) / ledger.aportes : 0;
  const subDivLabel = netoRetencion ? "neto de retención" : "bruto";

  const allocRows = computeAllocation(valuation.holdings, valuation.valorTotal, allocBy, moneda, port.decimales);
  const goalRows = [
    makeGoalRow("Dividendo mensual", dividendoProyectado / 12, port.objetivos.dividendoMensual, moneda, decimalesPrecio),
    makeGoalRow("Cobertura costo de vida", dividendoProyectado / 12, port.objetivos.costoVida, moneda, decimalesPrecio),
    makeGoalRow("Próximo gran hito · patrimonio", valuation.valorTotal, port.objetivos.hitoPatrimonio, moneda, port.decimales),
  ];

  const kpis: KpiCell[] = [
    { label: "Valor total de la cartera", value: formatCurrency(valuation.valorTotal, moneda, port.decimales), sub: "a precios marcados" },
    {
      label: "Rentabilidad total",
      value: formatPercent(retornoTotal * 100, true),
      sub: "incluye G/P realizada",
      colorClass: retornoTotal < 0 ? "text-accent-700" : undefined,
    },
    { label: "Aportes de capital", value: formatCurrency(ledger.aportes, moneda, port.decimales), sub: "capital invertido en compras" },
    { label: "Compras totales", value: formatCurrency(ledger.comprasTotales, moneda, port.decimales), sub: "acumulado histórico" },
    { label: "Dividendos cobrados", value: formatCurrency(0, moneda, port.decimales), sub: `histórico, ${subDivLabel}` },
    {
      label: "G/P realizada",
      value: `${ledger.gpRealizada >= 0 ? "+" : ""}${formatCurrency(ledger.gpRealizada, moneda, port.decimales)}`,
      sub: "ventas cerradas",
    },
    {
      label: "G/P no realizada",
      value: `${valuation.gpNoRealizada >= 0 ? "+" : ""}${formatCurrency(valuation.gpNoRealizada, moneda, port.decimales)}`,
      sub: "valor − costo de posiciones abiertas",
      colorClass: valuation.gpNoRealizada < 0 ? "text-accent-700" : undefined,
    },
    {
      label: "Yield on Cost",
      value: valuation.costoTotal > 0 ? formatPercent((valuation.dividendoProyectadoBruto / valuation.costoTotal) * 100) : "—",
      sub: "dividendo anual ÷ costo, bruto",
    },
    { label: "Dividendo mensual", value: formatCurrency(dividendoProyectado / 12, moneda, decimalesPrecio), sub: `promedio 12m, ${subDivLabel}` },
    { label: "Dividendos proyectados", value: formatCurrency(dividendoProyectado, moneda, port.decimales), sub: `próximos 12 meses, ${subDivLabel}` },
  ];

  const hoverPoint = hoverIndex !== null ? perfPoints[hoverIndex] : null;
  const editingMeta = editingTicker ? metas[editingTicker] : null;

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
            <SegmentedControl options={CURRENCY_OPTIONS} value={moneda} onChange={setMonedaOverride} size="compact" />
            <ToggleButton active={netoRetencion} onClick={toggleNetoRetencion} variant="accent">
              Neto de retención
            </ToggleButton>
          </>
        }
      />
      <PageContainer>
        <PageHeader
          kicker="MÓDULO 1 · PANEL"
          title={port.nombre}
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
                  decimales={port.decimales}
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
          onSubmit={handleAddTransaction}
        />
      )}
      {showHistoryModal && (
        <TransactionHistoryModal
          transactions={transactions}
          ccy={moneda}
          decimalesPrecio={decimalesPrecio}
          onClose={() => setShowHistoryModal(false)}
          onDelete={handleDeleteTransaction}
        />
      )}
      {editingMeta && (
        <EditHoldingModal
          meta={editingMeta}
          ccy={moneda}
          onClose={() => setEditingTicker(null)}
          onSave={handleSaveMeta}
          onDeleteAll={() => handleDeletePosition(editingMeta.ticker)}
        />
      )}
    </>
  );
}
