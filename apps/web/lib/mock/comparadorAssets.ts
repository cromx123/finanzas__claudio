import type { ComparadorAsset } from "../types";

export const COMPARADOR_ASSETS: Record<string, ComparadorAsset> = {
  SCHD: { ticker: "SCHD", nombre: "Schwab US Dividend", precio: 82.9, rentabilidadPromedioAnual: 8.1, yieldInicial: 3.4, cagrDiv5A: 9.2, cagrDiv3A: 7.0, expenseRatio: 0.06, aumOCap: "91,4B", retorno3A: 26.8, retorno5A: 62.1 },
  DGRO: { ticker: "DGRO", nombre: "iShares Core Dividend Growth", precio: 73.4, rentabilidadPromedioAnual: 10.0, yieldInicial: 2.0, cagrDiv5A: 7.1, cagrDiv3A: 7.1, expenseRatio: 0.08, aumOCap: "39,5B", retorno3A: 32.6, retorno5A: 68.9 },
  VYM: { ticker: "VYM", nombre: "Vanguard High Dividend Yield", precio: 121.7, rentabilidadPromedioAnual: 8.6, yieldInicial: 2.9, cagrDiv5A: 6.8, cagrDiv3A: 5.9, expenseRatio: 0.06, aumOCap: "62,8B", retorno3A: 28.4, retorno5A: 58.4 },
  VOO: { ticker: "VOO", nombre: "Vanguard S&P 500", precio: 590.2, rentabilidadPromedioAnual: 10.5, yieldInicial: 1.2, cagrDiv5A: 5.4, cagrDiv3A: 5.0, expenseRatio: 0.03, aumOCap: "1,48T", retorno3A: 48.2, retorno5A: 96.4 },
  JEPI: { ticker: "JEPI", nombre: "JPMorgan Equity Premium Income", precio: 59.8, rentabilidadPromedioAnual: 5.2, yieldInicial: 7.2, cagrDiv5A: 1.8, cagrDiv3A: 1.2, expenseRatio: 0.35, aumOCap: "41,2B", retorno3A: 18.4, retorno5A: 38.2 },
  JNJ: { ticker: "JNJ", nombre: "Johnson & Johnson", precio: 168.4, rentabilidadPromedioAnual: 6.5, yieldInicial: 2.9, cagrDiv5A: 5.8, cagrDiv3A: 5.2, expenseRatio: null, aumOCap: "405B", retorno3A: 21.4, retorno5A: 39.8 },
  KO: { ticker: "KO", nombre: "Coca-Cola", precio: 63.1, rentabilidadPromedioAnual: 6.0, yieldInicial: 3.1, cagrDiv5A: 4.6, cagrDiv3A: 4.9, expenseRatio: null, aumOCap: "272B", retorno3A: 18.9, retorno5A: 34.2 },
  MSFT: { ticker: "MSFT", nombre: "Microsoft", precio: 448.5, rentabilidadPromedioAnual: 14.0, yieldInicial: 0.7, cagrDiv5A: 10.2, cagrDiv3A: 10.1, expenseRatio: null, aumOCap: "3,33T", retorno3A: 68.4, retorno5A: 148.2 },
  "CHILE.SN": { ticker: "CHILE.SN", nombre: "Banco de Chile", precio: 121.3, rentabilidadPromedioAnual: 9.0, yieldInicial: 7.3, cagrDiv5A: 6.2, cagrDiv3A: 5.8, expenseRatio: null, aumOCap: "8,2B", retorno3A: 42.6, retorno5A: 88.4 },
  "ENELCHILE.SN": { ticker: "ENELCHILE.SN", nombre: "Enel Chile", precio: 68.9, rentabilidadPromedioAnual: 7.5, yieldInicial: 6.4, cagrDiv5A: 3.8, cagrDiv3A: 3.2, expenseRatio: null, aumOCap: "5,1B", retorno3A: 38.2, retorno5A: 64.2 },
};

export const COMPARADOR_OPTIONS = Object.values(COMPARADOR_ASSETS).map((a) => ({
  value: a.ticker,
  label: `${a.ticker} — ${a.nombre}`,
}));
