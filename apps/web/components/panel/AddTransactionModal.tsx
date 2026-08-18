"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Currency } from "../../lib/types";
import { formatCurrency, formatNumber } from "../../lib/format";
import { resolveTickerCurrency } from "../../lib/calc/tickerCurrency";
import { useAssetPriceOnDate, useAssetSearch, useScreener } from "../../hooks/useApi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";

interface AddTransactionModalProps {
  ccy: Currency;
  maxVenta: (yahooSymbol: string) => number;
  onClose: () => void;
  onSubmit: (input: { yahoo_symbol: string; type: "buy" | "sell"; trade_date: string; quantity: number; price: number }) => Promise<void> | void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_SUGGESTIONS = 10;

/** True only when the ticker or the name *starts with* the query — a
 * substring match would surface false positives like "ENELCHILE.SN" for
 * the query "CH" (it contains "ch" but isn't a Chile-adjacent suggestion). */
function matchesPrefix(symbol: string, name: string, query: string): boolean {
  return symbol.toUpperCase().startsWith(query) || name.toUpperCase().startsWith(query);
}

export function AddTransactionModal({ ccy, maxVenta, onClose, onSubmit }: AddTransactionModalProps) {
  const [ticker, setTicker] = useState("");
  const [debouncedTicker, setDebouncedTicker] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [tipo, setTipo] = useState<"Compra" | "Venta">("Compra");
  const [fecha, setFecha] = useState(todayIso());
  const [monto, setMonto] = useState<number | "">("");
  const [precio, setPrecio] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTicker(ticker), 250);
    return () => clearTimeout(t);
  }, [ticker]);

  useEffect(() => () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
  }, []);

  const { data: screener } = useScreener();
  const { data: yahooResults } = useAssetSearch(debouncedTicker);

  const suggestions = useMemo(() => {
    const q = ticker.trim().toUpperCase();
    if (!q) return [];
    const fromScreener = (screener ?? [])
      .filter((a) => matchesPrefix(a.yahoo_symbol, a.name, q))
      .map((a) => ({ symbol: a.yahoo_symbol, name: a.name }));
    const seen = new Set(fromScreener.map((s) => s.symbol));
    const fromYahoo = (yahooResults ?? []).filter((r) => matchesPrefix(r.symbol, r.name, q) && !seen.has(r.symbol));
    return [...fromScreener, ...fromYahoo].slice(0, MAX_SUGGESTIONS);
  }, [screener, yahooResults, ticker]);

  const showSuggestions = suggestOpen && suggestions.length > 0;

  const pickSuggestion = (symbol: string) => {
    setTicker(symbol);
    setDebouncedTicker(symbol);
    setSuggestOpen(false);
    setError(null);
  };

  const cantidad = typeof monto === "number" && typeof precio === "number" && precio > 0 ? monto / precio : 0;

  const tickerCurrency = useMemo(() => resolveTickerCurrency(ticker), [ticker]);
  const currencyMismatch = tickerCurrency !== null && tickerCurrency !== ccy;
  const inputCcy = tickerCurrency ?? ccy;

  const normalizedTicker = debouncedTicker.trim().toUpperCase();
  const { data: priceOnDate } = useAssetPriceOnDate(normalizedTicker || null, fecha || null);

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Ingresa un ticker.");
    if (currencyMismatch) {
      return setError(`${t} cotiza en ${tickerCurrency}, pero este portafolio es ${ccy} — no se pueden mezclar monedas.`);
    }
    if (!(typeof monto === "number" && monto > 0)) return setError("Ingresa un monto mayor a 0.");
    if (!(typeof precio === "number" && precio > 0)) return setError("Ingresa un precio por acción mayor a 0.");
    if (tipo === "Venta") {
      const disponible = maxVenta(t);
      if (cantidad > disponible + 1e-6) {
        return setError(`Solo tienes ${formatNumber(disponible)} acciones de ${t} para vender.`);
      }
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ yahoo_symbol: t, type: tipo === "Compra" ? "buy" : "sell", trade_date: fecha, quantity: cantidad, price: precio });
    } catch {
      setError(`No se pudo guardar. Revisa que "${t}" sea un ticker válido (ej: CHILE.SN, AAPL, IBE.MC).`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Agregar transacción" onClose={onClose}>
      <SegmentedControl
        options={[
          { label: "Compra", value: "Compra" as const },
          { label: "Venta", value: "Venta" as const },
        ]}
        value={tipo}
        onChange={setTipo}
        variant="accent"
        className="self-start"
      />
      <div className="relative">
        <Input
          label="Ticker"
          placeholder="Ej: CHILE.SN"
          value={ticker}
          autoComplete="off"
          onChange={(e) => {
            setTicker(e.target.value);
            setSuggestOpen(true);
          }}
          onFocus={() => setSuggestOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setSuggestOpen(false), 120);
          }}
        />
        {showSuggestions ? (
          <ul className="absolute z-10 left-0 right-0 mt-0.5 max-h-[260px] overflow-y-auto bg-surface border border-divider shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            {suggestions.map((s) => (
              <li key={s.symbol}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s.symbol)}
                  className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-ink/[0.06] cursor-pointer"
                >
                  <div className="truncate">{s.name}</div>
                  <div className="font-mono font-bold text-[11px] text-muted">{s.symbol}</div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {currencyMismatch ? (
        <p className="text-accent-700 text-xs">
          {ticker.trim().toUpperCase()} cotiza en {tickerCurrency}, pero este portafolio es {ccy} — usa un portafolio {tickerCurrency}.
        </p>
      ) : null}
      <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <Input
        label={`Monto invertido (${inputCcy})`}
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
      <Input
        label={`Precio por acción (${inputCcy})`}
        type="number"
        value={precio}
        onChange={(e) => setPrecio(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
      {priceOnDate ? (
        <button
          type="button"
          onClick={() => setPrecio(priceOnDate.price)}
          className="text-left text-[11.5px] text-muted hover:text-accent cursor-pointer -mt-1.5"
        >
          Precio de la acción el {priceOnDate.date}: <b>{formatCurrency(priceOnDate.price, inputCcy)}</b> — clic para usar
        </button>
      ) : null}
      <p className="text-muted text-xs">{cantidad > 0 ? `≈ ${formatNumber(cantidad)} acciones` : "Ingresa monto y precio para ver la cantidad"}</p>
      {error ? <p className="text-accent-700 text-xs">{error}</p> : null}
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving || currencyMismatch}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Modal>
  );
}
