"use client";

import { useState } from "react";
import type { Currency, TransactionType } from "../../lib/types";
import { formatNumber } from "../../lib/format";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";

interface AddTransactionModalProps {
  ccy: Currency;
  maxVenta: (ticker: string) => number;
  onClose: () => void;
  onSubmit: (input: { ticker: string; tipo: TransactionType; fecha: string; monto: number; precio: number }) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionModal({ ccy, maxVenta, onClose, onSubmit }: AddTransactionModalProps) {
  const [ticker, setTicker] = useState("");
  const [tipo, setTipo] = useState<TransactionType>("Compra");
  const [fecha, setFecha] = useState(todayIso());
  const [monto, setMonto] = useState<number | "">("");
  const [precio, setPrecio] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const cantidad = typeof monto === "number" && typeof precio === "number" && precio > 0 ? monto / precio : 0;

  const submit = () => {
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
    onSubmit({ ticker: t, tipo, fecha, monto, precio });
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
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={submit}>
          Guardar
        </Button>
      </div>
    </Modal>
  );
}
