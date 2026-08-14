import type { DividendPortfolioAsset, Portfolio } from "../types";

export const PORTFOLIOS: Record<"chile" | "global", Portfolio> = {
  chile: {
    key: "chile",
    nombre: "Dividendos Chile",
    moneda: "CLP",
    decimales: 0,
    decimalesPrecio: 0,
    retencion: 0,
    aportes: 23_500_000,
    dividendosCobrados: 1_486_000,
    gpRealizada: 312_000,
    comprasTotales: 25_400_000,
    objetivos: { dividendoMensual: 150_000, costoVida: 1_800_000, hitoPatrimonio: 30_000_000 },
    seedSerie: 7,
    driftSerie: 0.011,
    volSerie: 0.05,
    holdings: [
      { ticker: "CHILE.SN", nombre: "Banco de Chile", tipo: "Acción", tag: "DGI", sector: "Bancos", pais: "Chile", cantidad: 25000, costoPromedio: 98.5, precio: 121.3, dividendoAnualPorAccion: 8.9 },
      { ticker: "BSANTANDER.SN", nombre: "Banco Santander-Chile", tipo: "Acción", tag: "DGI", sector: "Bancos", pais: "Chile", cantidad: 18000, costoPromedio: 44.2, precio: 52.6, dividendoAnualPorAccion: 3.1 },
      { ticker: "COPEC.SN", nombre: "Empresas Copec", tipo: "Acción", tag: "DGI", sector: "Energía", pais: "Chile", cantidad: 900, costoPromedio: 6350, precio: 7180, dividendoAnualPorAccion: 182 },
      { ticker: "CMPC.SN", nombre: "Empresas CMPC", tipo: "Acción", tag: "DGI", sector: "Materiales", pais: "Chile", cantidad: 3200, costoPromedio: 1490, precio: 1655, dividendoAnualPorAccion: 62, stale: true },
      { ticker: "ENELCHILE.SN", nombre: "Enel Chile", tipo: "Acción", tag: "High Yield", sector: "Utilities", pais: "Chile", cantidad: 60000, costoPromedio: 52.4, precio: 68.9, dividendoAnualPorAccion: 4.4 },
      { ticker: "SQM-B.SN", nombre: "SQM", tipo: "Acción", tag: "Growth", sector: "Materiales", pais: "Chile", cantidad: 180, costoPromedio: 41200, precio: 38950, dividendoAnualPorAccion: 1120 },
    ],
    proximosDividendos: [
      { ticker: "ENELCHILE.SN", fecha: "28 AGO 26", montoPorAccion: 2.2, cantidad: 60000, estado: "Confirmado" },
      { ticker: "CHILE.SN", fecha: "15 SEP 26", montoPorAccion: 4.5, cantidad: 25000, estado: "Estimado" },
      { ticker: "COPEC.SN", fecha: "02 OCT 26", montoPorAccion: 91, cantidad: 900, estado: "Estimado" },
      { ticker: "BSANTANDER.SN", fecha: "20 OCT 26", montoPorAccion: 1.6, cantidad: 18000, estado: "Confirmado" },
    ],
  },
  global: {
    key: "global",
    nombre: "Global Dividendos",
    moneda: "USD",
    decimales: 0,
    decimalesPrecio: 2,
    retencion: 0.3,
    aportes: 52_400,
    dividendosCobrados: 3184,
    gpRealizada: 1120,
    comprasTotales: 53_900,
    objetivos: { dividendoMensual: 150, costoVida: 2500, hitoPatrimonio: 75_000 },
    seedSerie: 11,
    driftSerie: 0.013,
    volSerie: 0.04,
    holdings: [
      { ticker: "JNJ", nombre: "Johnson & Johnson", tipo: "Acción", tag: "DGI", sector: "Salud", pais: "EE.UU.", cantidad: 40, costoPromedio: 152, precio: 168.4, dividendoAnualPorAccion: 4.96 },
      { ticker: "KO", nombre: "Coca-Cola", tipo: "Acción", tag: "DGI", sector: "Consumo básico", pais: "EE.UU.", cantidad: 120, costoPromedio: 58.2, precio: 63.1, dividendoAnualPorAccion: 1.94 },
      { ticker: "PG", nombre: "Procter & Gamble", tipo: "Acción", tag: "DGI", sector: "Consumo básico", pais: "EE.UU.", cantidad: 35, costoPromedio: 148.9, precio: 171.2, dividendoAnualPorAccion: 4.03 },
      { ticker: "SCHD", nombre: "Schwab US Dividend Equity", tipo: "ETF", tag: "ETF Dividendos", sector: "ETF diversificado", pais: "EE.UU.", cantidad: 210, costoPromedio: 74.5, precio: 82.9, dividendoAnualPorAccion: 2.84 },
      { ticker: "VYM", nombre: "Vanguard High Dividend Yield", tipo: "ETF", tag: "ETF Dividendos", sector: "ETF diversificado", pais: "EE.UU.", cantidad: 60, costoPromedio: 108.3, precio: 121.7, dividendoAnualPorAccion: 3.42 },
      { ticker: "MSFT", nombre: "Microsoft", tipo: "Acción", tag: "Growth", sector: "Tecnología", pais: "EE.UU.", cantidad: 18, costoPromedio: 372, precio: 448.5, dividendoAnualPorAccion: 3.32 },
      { ticker: "GOOGL", nombre: "Alphabet", tipo: "Acción", tag: "Growth", sector: "Tecnología", pais: "EE.UU.", cantidad: 25, costoPromedio: 158.6, precio: 196.3, dividendoAnualPorAccion: 0.8 },
    ],
    proximosDividendos: [
      { ticker: "JNJ", fecha: "09 SEP 26", montoPorAccion: 1.24, cantidad: 40, estado: "Confirmado" },
      { ticker: "MSFT", fecha: "11 SEP 26", montoPorAccion: 0.83, cantidad: 18, estado: "Confirmado" },
      { ticker: "SCHD", fecha: "25 SEP 26", montoPorAccion: 0.71, cantidad: 210, estado: "Estimado" },
      { ticker: "KO", fecha: "01 OCT 26", montoPorAccion: 0.485, cantidad: 120, estado: "Confirmado" },
    ],
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
