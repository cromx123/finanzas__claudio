"use client";

import { useMemo, useState } from "react";
import type { Currency } from "../../lib/types";
import { formatCurrency, formatNumber } from "../../lib/format";
import { resolveTickerCurrency } from "../../lib/calc/tickerCurrency";
import { useAssetPriceOnDate, useOpenLots } from "../../hooks/useApi";
import { TickerAutocomplete } from "../shared/TickerAutocomplete";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";

type LotStrategy = "fifo" | "lifo" | "specific";

const LOT_STRATEGY_OPTIONS: { label: string; value: LotStrategy }[] = [
  { label: "FIFO", value: "fifo" },
  { label: "LIFO", value: "lifo" },
  { label: "Específico", value: "specific" },
];

interface AddTransactionModalProps {
  portfolioId: string;
  ccy: Currency;
  maxVenta: (yahooSymbol: string) => number;
  onClose: () => void;
  onSubmit: (input: {
    yahoo_symbol: string;
    type: "buy" | "sell";
    trade_date: string;
    quantity: number;
    price: number;
    lot_strategy?: LotStrategy;
    lots?: Record<string, number>;
  }) => Promise<void> | void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionModal({ portfolioId, ccy, maxVenta, onClose, onSubmit }: AddTransactionModalProps) {
  const [ticker, setTicker] = useState("");
  const [normalizedTicker, setNormalizedTicker] = useState("");
  const [tipo, setTipo] = useState<"Compra" | "Venta">("Compra");
  const [fecha, setFecha] = useState(todayIso());
  const [monto, setMonto] = useState<number | "">("");
  const [precio, setPrecio] = useState<number | "">("");
  const [lotStrategy, setLotStrategy] = useState<LotStrategy>("fifo");
  const [lotQuantities, setLotQuantities] = useState<Record<string, number | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cantidad = typeof monto === "number" && typeof precio === "number" && precio > 0 ? monto / precio : 0;

  const tickerCurrency = useMemo(() => resolveTickerCurrency(ticker), [ticker]);
  const currencyMismatch = tickerCurrency !== null && tickerCurrency !== ccy;
  const inputCcy = tickerCurrency ?? ccy;

  const { data: priceOnDate } = useAssetPriceOnDate(normalizedTicker || null, fecha || null);
  const { data: openLots } = useOpenLots(tipo === "Venta" ? portfolioId : null, tipo === "Venta" ? normalizedTicker || null : null);

  const specificTotal = Object.values(lotQuantities).reduce((sum: number, q) => sum + (typeof q === "number" ? q : 0), 0);

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
      if (lotStrategy === "specific" && Math.abs(specificTotal - cantidad) > 1e-6) {
        return setError(`Los lotes elegidos suman ${formatNumber(specificTotal)} — deben sumar exactamente ${formatNumber(cantidad)}.`);
      }
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        yahoo_symbol: t,
        type: tipo === "Compra" ? "buy" : "sell",
        trade_date: fecha,
        quantity: cantidad,
        price: precio,
        ...(tipo === "Venta"
          ? {
              lot_strategy: lotStrategy,
              ...(lotStrategy === "specific"
                ? {
                    lots: Object.fromEntries(
                      Object.entries(lotQuantities).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0)
                    ),
                  }
                : {}),
            }
          : {}),
      });
    } catch {
      setError(`No se pudo guardar. Revisa que "${t}" sea un ticker válido (ej: CHILE.SN, AAPL, IBE.MC).`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Agregar transacción" onClose={onClose} width={tipo === "Venta" && lotStrategy === "specific" ? 560 : 440}>
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
      <TickerAutocomplete
        label="Ticker"
        placeholder="Ej: CHILE.SN"
        value={ticker}
        onChange={(v) => {
          setTicker(v);
          setError(null);
        }}
        onSelect={() => setError(null)}
        onDebouncedChange={(v) => setNormalizedTicker(v.trim().toUpperCase())}
      />
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

      {tipo === "Venta" && openLots && openLots.length > 0 ? (
        <div className="field">
          <label className="block text-xs mb-1 text-ink/70">Lote a vender</label>
          <SegmentedControl options={LOT_STRATEGY_OPTIONS} value={lotStrategy} onChange={setLotStrategy} size="compact" />
          {lotStrategy === "specific" ? (
            <div className="mt-2.5 border border-divider">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] uppercase text-ink/60 p-1.5 border-b border-divider">Fecha</th>
                    <th className="text-right text-[10px] uppercase text-ink/60 p-1.5 border-b border-divider">Disponible</th>
                    <th className="text-right text-[10px] uppercase text-ink/60 p-1.5 border-b border-divider">Precio</th>
                    <th className="text-right text-[10px] uppercase text-ink/60 p-1.5 border-b border-divider">Vender</th>
                  </tr>
                </thead>
                <tbody>
                  {openLots.map((lot) => (
                    <tr key={lot.id}>
                      <td className="p-1.5 border-b border-divider whitespace-nowrap">{lot.trade_date}</td>
                      <td className="p-1.5 border-b border-divider text-right">{formatNumber(lot.quantity)}</td>
                      <td className="p-1.5 border-b border-divider text-right whitespace-nowrap">
                        {formatCurrency(lot.price, inputCcy)}
                      </td>
                      <td className="p-1.5 border-b border-divider text-right">
                        <input
                          type="number"
                          min={0}
                          max={lot.quantity}
                          value={lotQuantities[lot.id] ?? ""}
                          onChange={(e) =>
                            setLotQuantities((prev) => ({
                              ...prev,
                              [lot.id]: e.target.value === "" ? "" : parseFloat(e.target.value),
                            }))
                          }
                          className="w-20 min-h-7 px-1.5 py-1 text-right text-[12px] text-ink bg-surface border border-divider outline-none focus-visible:border-accent"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={`text-[11px] px-1.5 py-1.5 ${Math.abs(specificTotal - cantidad) > 1e-6 ? "text-accent-700" : "text-muted"}`}>
                Elegido: {formatNumber(specificTotal)} de {formatNumber(cantidad)} acciones
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

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
