"use client";

import { createContext, useContext } from "react";
import { nextId } from "../lib/calc/ledger";
import { COUNTRY_RETENCION_DEFAULT, defaultObjectives } from "../lib/mock/countries";
import { DEFAULT_FX_RATES, convertAmount } from "../lib/mock/fx";
import { useLocalStorageJSON } from "../lib/storage";
import type { Country, Currency, HoldingMeta, PortfolioConfig, Transaction, TransactionType } from "../lib/types";

const PORTFOLIOS_KEY = "inversiones-3.0:portfolios";
const ACTIVE_KEY = "inversiones-3.0:active-portfolio";
const TX_KEY = "inversiones-3.0:transactions";
const METAS_KEY = "inversiones-3.0:metas";
const FX_KEY = "inversiones-3.0:fx-rates";
const NETO_KEY = "inversiones-3.0:neto";

const EMPTY_PORTFOLIOS: PortfolioConfig[] = [];
const EMPTY_TX_MAP: Record<string, Transaction[]> = {};
const EMPTY_METAS_MAP: Record<string, Record<string, HoldingMeta>> = {};
const EMPTY_TX: Transaction[] = [];
const EMPTY_META: Record<string, HoldingMeta> = {};

interface PortfoliosContextValue {
  portfolios: PortfolioConfig[];
  activePortfolioId: string | null;
  activePortfolio: PortfolioConfig | null;
  setActivePortfolioId: (id: string) => void;
  addPortfolio: (input: { nombre: string; moneda: Currency; pais: Country }) => void;
  updatePortfolio: (id: string, patch: { nombre: string; moneda: Currency; pais: Country; retencion: number }) => void;
  deletePortfolio: (id: string) => void;

  getTransactions: (portfolioId: string) => Transaction[];
  addTransaction: (portfolioId: string, input: { ticker: string; tipo: TransactionType; fecha: string; monto: number; precio: number }) => void;
  deleteTransaction: (portfolioId: string, txId: string) => void;

  getMetas: (portfolioId: string) => Record<string, HoldingMeta>;
  saveMeta: (portfolioId: string, meta: HoldingMeta) => void;
  deletePosition: (portfolioId: string, ticker: string) => void;

  netoRetencion: boolean;
  toggleNetoRetencion: () => void;

  fxRates: Record<Currency, number>;
  setFxRate: (ccy: Currency, rateToClp: number) => void;
}

const Ctx = createContext<PortfoliosContextValue | null>(null);

export function PortfoliosProvider({ children }: { children: React.ReactNode }) {
  const [portfolios, setPortfolios] = useLocalStorageJSON<PortfolioConfig[]>(PORTFOLIOS_KEY, EMPTY_PORTFOLIOS);
  const [activePortfolioId, setActivePortfolioIdRaw] = useLocalStorageJSON<string | null>(ACTIVE_KEY, null);
  const [txMap, setTxMap] = useLocalStorageJSON<Record<string, Transaction[]>>(TX_KEY, EMPTY_TX_MAP);
  const [metasMap, setMetasMap] = useLocalStorageJSON<Record<string, Record<string, HoldingMeta>>>(METAS_KEY, EMPTY_METAS_MAP);
  const [fxRates, setFxRates] = useLocalStorageJSON<Record<Currency, number>>(FX_KEY, DEFAULT_FX_RATES);
  const [netoRetencion, setNetoRetencion] = useLocalStorageJSON<boolean>(NETO_KEY, true);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null;

  const addPortfolio: PortfoliosContextValue["addPortfolio"] = ({ nombre, moneda, pais }) => {
    const portfolio: PortfolioConfig = {
      id: nextId(),
      nombre,
      moneda,
      pais,
      retencion: COUNTRY_RETENCION_DEFAULT[pais],
      objetivos: defaultObjectives(moneda),
    };
    setPortfolios([...portfolios, portfolio]);
    setActivePortfolioIdRaw(portfolio.id);
  };

  const updatePortfolio: PortfoliosContextValue["updatePortfolio"] = (id, patch) => {
    const current = portfolios.find((p) => p.id === id);
    if (!current) return;
    const currencyChanged = patch.moneda !== current.moneda;

    let objetivos = current.objetivos;
    if (currencyChanged) {
      const convert = (v: number) => convertAmount(v, current.moneda, patch.moneda, fxRates);

      const txs = txMap[id] ?? [];
      setTxMap({ ...txMap, [id]: txs.map((t) => ({ ...t, monto: convert(t.monto), precio: convert(t.precio) })) });

      const metas = metasMap[id] ?? {};
      const convertedMetas: Record<string, HoldingMeta> = {};
      Object.entries(metas).forEach(([ticker, meta]) => {
        convertedMetas[ticker] = { ...meta, precioActual: convert(meta.precioActual), dividendoAnualPorAccion: convert(meta.dividendoAnualPorAccion) };
      });
      setMetasMap({ ...metasMap, [id]: convertedMetas });

      objetivos = {
        dividendoMensual: convert(current.objetivos.dividendoMensual),
        costoVida: convert(current.objetivos.costoVida),
        hitoPatrimonio: convert(current.objetivos.hitoPatrimonio),
      };
    }

    setPortfolios(portfolios.map((p) => (p.id === id ? { ...p, ...patch, objetivos } : p)));
  };

  const deletePortfolio: PortfoliosContextValue["deletePortfolio"] = (id) => {
    setPortfolios(portfolios.filter((p) => p.id !== id));
    const nextTx = { ...txMap };
    delete nextTx[id];
    setTxMap(nextTx);
    const nextMetas = { ...metasMap };
    delete nextMetas[id];
    setMetasMap(nextMetas);
    if (activePortfolioId === id) {
      const remaining = portfolios.filter((p) => p.id !== id);
      setActivePortfolioIdRaw(remaining[0]?.id ?? null);
    }
  };

  const getTransactions = (portfolioId: string) => txMap[portfolioId] ?? EMPTY_TX;
  const getMetas = (portfolioId: string) => metasMap[portfolioId] ?? EMPTY_META;

  const addTransaction: PortfoliosContextValue["addTransaction"] = (portfolioId, input) => {
    const tx: Transaction = { id: nextId(), ...input, cantidad: input.monto / input.precio };
    const txs = txMap[portfolioId] ?? [];
    setTxMap({ ...txMap, [portfolioId]: [...txs, tx] });

    const metas = metasMap[portfolioId] ?? {};
    if (!metas[input.ticker]) {
      const portfolio = portfolios.find((p) => p.id === portfolioId);
      const meta: HoldingMeta = {
        ticker: input.ticker,
        nombre: input.ticker,
        tipo: "Acción",
        tag: "Sin etiqueta",
        sector: "Sin sector",
        pais: portfolio?.pais ?? "Otro",
        precioActual: input.precio,
        dividendoAnualPorAccion: 0,
      };
      setMetasMap({ ...metasMap, [portfolioId]: { ...metas, [input.ticker]: meta } });
    }
  };

  const deleteTransaction: PortfoliosContextValue["deleteTransaction"] = (portfolioId, txId) => {
    const txs = txMap[portfolioId] ?? [];
    setTxMap({ ...txMap, [portfolioId]: txs.filter((t) => t.id !== txId) });
  };

  const saveMeta: PortfoliosContextValue["saveMeta"] = (portfolioId, meta) => {
    const metas = metasMap[portfolioId] ?? {};
    setMetasMap({ ...metasMap, [portfolioId]: { ...metas, [meta.ticker]: meta } });
  };

  const deletePosition: PortfoliosContextValue["deletePosition"] = (portfolioId, ticker) => {
    const txs = txMap[portfolioId] ?? [];
    setTxMap({ ...txMap, [portfolioId]: txs.filter((t) => t.ticker !== ticker) });
    const metas = { ...(metasMap[portfolioId] ?? {}) };
    delete metas[ticker];
    setMetasMap({ ...metasMap, [portfolioId]: metas });
  };

  const setFxRate = (ccy: Currency, rateToClp: number) => {
    setFxRates({ ...fxRates, [ccy]: rateToClp });
  };

  return (
    <Ctx.Provider
      value={{
        portfolios,
        activePortfolioId,
        activePortfolio,
        setActivePortfolioId: setActivePortfolioIdRaw,
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
        toggleNetoRetencion: () => setNetoRetencion(!netoRetencion),
        fxRates,
        setFxRate,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePortfolios() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortfolios must be used within PortfoliosProvider");
  return ctx;
}
