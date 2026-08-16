import type { Country, Currency, PortfolioObjectives } from "../types";

export const COUNTRIES: Country[] = ["Chile", "EE.UU.", "España", "Otro"];

/** Default dividend withholding rate by country — editable per portfolio afterward. */
export const COUNTRY_RETENCION_DEFAULT: Record<Country, number> = {
  Chile: 0,
  "EE.UU.": 0.3,
  España: 0.19,
  Otro: 0,
};

export const COUNTRY_CURRENCY_DEFAULT: Record<Country, Currency> = {
  Chile: "CLP",
  "EE.UU.": "USD",
  España: "EUR",
  Otro: "USD",
};

export function defaultObjectives(ccy: Currency): PortfolioObjectives {
  if (ccy === "CLP") return { dividendoMensual: 150_000, costoVida: 1_000_000, hitoPatrimonio: 20_000_000 };
  return { dividendoMensual: 150, costoVida: 1500, hitoPatrimonio: 20_000 };
}
