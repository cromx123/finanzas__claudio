"use client";

import { useState } from "react";
import type { Currency } from "../../lib/types";
import { formatNumber } from "../../lib/format";
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

export function AddTransactionModal({ ccy, maxVenta, onClose, onSubmit }: AddTransactionModalProps) {
  const [ticker, setTicker] = useState("");
  const [tipo, setTipo] = useState<"Compra" | "Venta">("Compra");
  const [fecha, setFecha] = useState(todayIso());
  const [monto, setMonto] = useState<number | "">("");
  const [precio, setPrecio] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cantidad = typeof monto === "number" && typeof precio === "number" && precio > 0 ? monto / precio : 0;

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Ingresa un ticker.");
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
      <Input label="Ticker" placeholder="Ej: CHILE.SN" value={ticker} onChange={(e) => setTicker(e.target.value)} />
      <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <Input
        label={`Monto invertido (${ccy})`}
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
      <Input
        label={`Precio por acción (${ccy})`}
        type="number"
        value={precio}
        onChange={(e) => setPrecio(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
      <p className="text-muted text-xs">{cantidad > 0 ? `≈ ${formatNumber(cantidad)} acciones` : "Ingresa monto y precio para ver la cantidad"}</p>
      {error ? <p className="text-accent-700 text-xs">{error}</p> : null}
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Modal>
  );
}
