import type { DividendPortfolioAsset, Portfolio } from "../types";

export const PORTFOLIOS: Record<"chile" | "global", Portfolio> = {
  chile: {
    key: "chile",
    nombre: "Dividendos Chile",
    moneda: "CLP",
    decimales: 0,
    decimalesPrecio: 0,
    retencion: 0,
    objetivos: { dividendoMensual: 150_000, costoVida: 1_800_000, hitoPatrimonio: 30_000_000 },
    seedSerie: 7,
    driftSerie: 0.011,
    volSerie: 0.05,
  },
  global: {
    key: "global",
    nombre: "Global Dividendos",
    moneda: "USD",
    decimales: 0,
    decimalesPrecio: 2,
    retencion: 0.3,
    objetivos: { dividendoMensual: 150, costoVida: 2500, hitoPatrimonio: 75_000 },
    seedSerie: 11,
    driftSerie: 0.013,
    volSerie: 0.04,
  },
};

export const SP500_SERIE = { seed: 3, drift: 0.0105, vol: 0.045 };

export const DIVIDEND_CALENDAR: Record<"chile" | "global", { nombre: string; ccy: "CLP" | "USD"; retencion: number; activos: DividendPortfolioAsset[] }> = {
  chile: {
    nombre: "Dividendos Chile",
    ccy: "CLP",
    retencion: 0,
    activos: [
      { ticker: "CHILE.SN", nombre: "Banco de Chile", cantidad: 25000, pagos: [{ mes: 2, dia: 28, montoPorAccion: 8.9 }] },
      { ticker: "BSANTANDER.SN", nombre: "Banco Santander-Chile", cantidad: 18000, pagos: [{ mes: 3, dia: 20, montoPorAccion: 3.1 }] },
      { ticker: "COPEC.SN", nombre: "Empresas Copec", cantidad: 900, pagos: [{ mes: 4, dia: 15, montoPorAccion: 91 }, { mes: 11, dia: 10, montoPorAccion: 91 }] },
      { ticker: "CMPC.SN", nombre: "Empresas CMPC", cantidad: 3200, pagos: [{ mes: 4, dia: 28, montoPorAccion: 62 }] },
      { ticker: "ENELCHILE.SN", nombre: "Enel Chile", cantidad: 60000, pagos: [{ mes: 0, dia: 30, montoPorAccion: 2.2 }, { mes: 7, dia: 28, montoPorAccion: 2.2 }] },
      { ticker: "SQM-B.SN", nombre: "SQM", cantidad: 180, pagos: [{ mes: 2, dia: 12, montoPorAccion: 280 }, { mes: 5, dia: 12, montoPorAccion: 280 }, { mes: 8, dia: 12, montoPorAccion: 280 }, { mes: 11, dia: 12, montoPorAccion: 280 }] },
    ],
  },
  global: {
    nombre: "Global Dividendos",
    ccy: "USD",
    retencion: 0.3,
    activos: [
      { ticker: "JNJ", nombre: "Johnson & Johnson", cantidad: 40, pagos: [{ mes: 2, dia: 10, montoPorAccion: 1.19 }, { mes: 5, dia: 9, montoPorAccion: 1.24 }, { mes: 8, dia: 9, montoPorAccion: 1.24 }, { mes: 11, dia: 8, montoPorAccion: 1.24 }] },
      { ticker: "KO", nombre: "Coca-Cola", cantidad: 120, pagos: [{ mes: 3, dia: 1, montoPorAccion: 0.485 }, { mes: 6, dia: 1, montoPorAccion: 0.485 }, { mes: 9, dia: 1, montoPorAccion: 0.485 }, { mes: 11, dia: 15, montoPorAccion: 0.485 }] },
      { ticker: "PG", nombre: "Procter & Gamble", cantidad: 35, pagos: [{ mes: 1, dia: 17, montoPorAccion: 1.0 }, { mes: 4, dia: 15, montoPorAccion: 1.0 }, { mes: 7, dia: 14, montoPorAccion: 1.01 }, { mes: 10, dia: 16, montoPorAccion: 1.02 }] },
      { ticker: "SCHD", nombre: "Schwab US Dividend Equity", cantidad: 210, pagos: [{ mes: 2, dia: 25, montoPorAccion: 0.68 }, { mes: 5, dia: 25, montoPorAccion: 0.7 }, { mes: 8, dia: 25, montoPorAccion: 0.71 }, { mes: 11, dia: 14, montoPorAccion: 0.75 }] },
      { ticker: "VYM", nombre: "Vanguard High Dividend Yield", cantidad: 60, pagos: [{ mes: 2, dia: 22, montoPorAccion: 0.82 }, { mes: 5, dia: 22, montoPorAccion: 0.85 }, { mes: 8, dia: 22, montoPorAccion: 0.86 }, { mes: 11, dia: 20, montoPorAccion: 0.89 }] },
      { ticker: "MSFT", nombre: "Microsoft", cantidad: 18, pagos: [{ mes: 2, dia: 12, montoPorAccion: 0.83 }, { mes: 5, dia: 11, montoPorAccion: 0.83 }, { mes: 8, dia: 11, montoPorAccion: 0.83 }, { mes: 11, dia: 10, montoPorAccion: 0.83 }] },
      { ticker: "GOOGL", nombre: "Alphabet", cantidad: 25, pagos: [{ mes: 2, dia: 17, montoPorAccion: 0.2 }, { mes: 5, dia: 16, montoPorAccion: 0.2 }, { mes: 8, dia: 15, montoPorAccion: 0.2 }, { mes: 11, dia: 16, montoPorAccion: 0.2 }] },
    ],
  },
};
