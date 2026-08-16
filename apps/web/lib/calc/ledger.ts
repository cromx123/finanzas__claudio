import type { Holding, HoldingMeta, Transaction } from "../types";

export interface LedgerSummary {
  holdings: Holding[];
  comprasTotales: number;
  aportes: number;
  gpRealizada: number;
}

/**
 * Derives current holdings + portfolio-level totals from the raw
 * transaction ledger, average-cost method (business rule 6: métricas
 * derivadas se calculan al leer, no se guardan).
 */
export function buildLedgerSummary(transactions: Transaction[], metas: Record<string, HoldingMeta>): LedgerSummary {
  const byTicker = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    const list = byTicker.get(tx.ticker) ?? [];
    list.push(tx);
    byTicker.set(tx.ticker, list);
  });

  let comprasTotales = 0;
  let gpRealizada = 0;
  const holdings: Holding[] = [];

  byTicker.forEach((txs, ticker) => {
    const sorted = [...txs].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let cantidad = 0;
    let costoTotal = 0;

    sorted.forEach((tx) => {
      if (tx.tipo === "Compra") {
        cantidad += tx.cantidad;
        costoTotal += tx.monto;
        comprasTotales += tx.monto;
      } else {
        const avgCost = cantidad > 0 ? costoTotal / cantidad : 0;
        const vendida = Math.min(tx.cantidad, cantidad);
        const costoVendido = avgCost * vendida;
        gpRealizada += tx.monto - costoVendido;
        cantidad = Math.max(0, cantidad - vendida);
        costoTotal = Math.max(0, costoTotal - costoVendido);
      }
    });

    if (cantidad > 1e-6) {
      const meta = metas[ticker];
      const costoPromedio = costoTotal / cantidad;
      holdings.push({
        ticker,
        nombre: meta?.nombre ?? ticker,
        tipo: meta?.tipo ?? "Acción",
        tag: meta?.tag ?? "Sin etiqueta",
        sector: meta?.sector ?? "Sin sector",
        pais: meta?.pais ?? "—",
        cantidad,
        costoPromedio,
        precio: meta?.precioActual ?? costoPromedio,
        dividendoAnualPorAccion: meta?.dividendoAnualPorAccion ?? 0,
      });
    }
  });

  holdings.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return { holdings, comprasTotales, aportes: comprasTotales, gpRealizada };
}

export function inferPaisFromTicker(ticker: string): string {
  if (ticker.endsWith(".SN")) return "Chile";
  if (ticker.endsWith(".MC")) return "España";
  return "EE.UU.";
}

/** Net shares currently held for a ticker, used to cap sell quantities. */
export function currentQuantity(transactions: Transaction[], ticker: string): number {
  return transactions
    .filter((tx) => tx.ticker === ticker)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .reduce((qty, tx) => (tx.tipo === "Compra" ? qty + tx.cantidad : Math.max(0, qty - tx.cantidad)), 0);
}

export function nextId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
