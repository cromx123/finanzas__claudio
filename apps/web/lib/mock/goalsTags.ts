import type { GoalAsset } from "../types";

export const TAGS_INICIALES: string[] = ["DGI", "High Yield", "ETF Dividendos", "Growth", "REITs", "Crypto"];

export const ASIGNACIONES_INICIALES: Record<string, string[]> = {
  "CHILE.SN": ["DGI"],
  "BSANTANDER.SN": ["DGI"],
  "COPEC.SN": ["DGI"],
  "CMPC.SN": ["DGI"],
  "ENELCHILE.SN": ["High Yield"],
  "SQM-B.SN": ["Growth"],
  JNJ: ["DGI"],
  KO: ["DGI"],
  PG: ["DGI"],
  SCHD: ["ETF Dividendos"],
  VYM: ["ETF Dividendos"],
  MSFT: ["Growth"],
  GOOGL: ["Growth"],
};

export const GOAL_ASSETS: GoalAsset[] = [
  { ticker: "CHILE.SN", nombre: "Banco de Chile", monedaNativa: "CLP", valorNativo: 3_032_500, dividendoAnualNativo: 222_500 },
  { ticker: "BSANTANDER.SN", nombre: "Banco Santander-Chile", monedaNativa: "CLP", valorNativo: 946_800, dividendoAnualNativo: 55_800 },
  { ticker: "COPEC.SN", nombre: "Empresas Copec", monedaNativa: "CLP", valorNativo: 6_462_000, dividendoAnualNativo: 163_800 },
  { ticker: "CMPC.SN", nombre: "Empresas CMPC", monedaNativa: "CLP", valorNativo: 5_296_000, dividendoAnualNativo: 198_400 },
  { ticker: "ENELCHILE.SN", nombre: "Enel Chile", monedaNativa: "CLP", valorNativo: 4_134_000, dividendoAnualNativo: 264_000 },
  { ticker: "SQM-B.SN", nombre: "SQM", monedaNativa: "CLP", valorNativo: 7_011_000, dividendoAnualNativo: 201_600 },
  { ticker: "JNJ", nombre: "Johnson & Johnson", monedaNativa: "USD", valorNativo: 6736, dividendoAnualNativo: 138.9 },
  { ticker: "KO", nombre: "Coca-Cola", monedaNativa: "USD", valorNativo: 7572, dividendoAnualNativo: 163.0 },
  { ticker: "PG", nombre: "Procter & Gamble", monedaNativa: "USD", valorNativo: 5992, dividendoAnualNativo: 98.7 },
  { ticker: "SCHD", nombre: "Schwab US Dividend Equity", monedaNativa: "USD", valorNativo: 17_409, dividendoAnualNativo: 417.5 },
  { ticker: "VYM", nombre: "Vanguard High Dividend Yield", monedaNativa: "USD", valorNativo: 7302, dividendoAnualNativo: 143.6 },
  { ticker: "MSFT", nombre: "Microsoft", monedaNativa: "USD", valorNativo: 8073, dividendoAnualNativo: 41.8 },
  { ticker: "GOOGL", nombre: "Alphabet", monedaNativa: "USD", valorNativo: 4907, dividendoAnualNativo: 14.0 },
];

export const FI_HITOS = [25_000, 50_000, 100_000, 250_000];
export const FX_CLP_USD_DEFAULT = 970;
