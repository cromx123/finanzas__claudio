"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useCreateAlert, useDeleteAlert } from "../../hooks/useApi";
import type { AlertCondition, ApiAlert } from "../../lib/api/types";
import { formatCurrency } from "../../lib/format";
import type { Currency } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Tag } from "../ui/Tag";

const CONDITION_OPTIONS: { label: string; value: AlertCondition }[] = [
  { label: "Baja de", value: "price_below" },
  { label: "Sube de", value: "price_above" },
];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AlertsPanel({ alerts, isLoading }: { alerts: ApiAlert[]; isLoading: boolean }) {
  const [ticker, setTicker] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("price_below");
  const [threshold, setThreshold] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Ingresa un ticker.");
    if (!(typeof threshold === "number" && threshold > 0)) return setError("Ingresa un precio mayor a 0.");
    setError(null);
    try {
      await createAlert.mutateAsync({ yahoo_symbol: t, condition, threshold });
      setTicker("");
      setThreshold("");
    } catch {
      setError(`No se pudo crear la alerta. Revisa que "${t}" sea un ticker válido (ej: CHILE.SN, AAPL, IBE.MC, 7203.T).`);
    }
  };

  const active = alerts.filter((a) => a.active);
  const triggered = alerts.filter((a) => !a.active);

  return (
    <div>
      <p className="text-muted text-[11.5px] mb-4 max-w-[640px]">
        Seguí cualquier ticker esté o no en tus portafolios — se revisa una vez al día, después del cierre de mercado. Es solo
        dentro de la app: no hay email ni push, acá es donde vas a ver si se disparó.
      </p>

      <div className="flex items-end gap-2.5 flex-wrap mb-2 pb-5 border-b border-divider">
        <Input
          label="Ticker"
          placeholder="Ej: CHILE.SN, AAPL"
          value={ticker}
          autoComplete="off"
          onChange={(e) => setTicker(e.target.value)}
          className="w-[160px]"
        />
        <div className="field">
          <label className="block text-xs mb-1 text-ink/70">Condición</label>
          <SegmentedControl options={CONDITION_OPTIONS} value={condition} onChange={setCondition} size="compact" />
        </div>
        <Input
          label="Precio"
          type="number"
          placeholder="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))}
          className="w-[120px]"
        />
        <Button variant="primary" onClick={submit} disabled={createAlert.isPending} className="text-xs">
          {createAlert.isPending ? "Creando…" : "Crear alerta"}
        </Button>
      </div>
      {error ? <p className="text-accent-700 text-xs mt-2">{error}</p> : null}

      {isLoading ? (
        <p className="text-muted text-sm py-6">Cargando…</p>
      ) : alerts.length === 0 ? (
        <p className="text-muted text-sm py-6">Todavía no tienes alertas. Creá la primera arriba.</p>
      ) : (
        <div className="mt-5">
          {active.length > 0 ? (
            <div className="mb-6">
              <h6 className="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-ink/60">
                Activas — {active.length}
              </h6>
              <AlertsTable rows={active} onDelete={(id) => deleteAlert.mutate(id)} />
            </div>
          ) : null}
          {triggered.length > 0 ? (
            <div>
              <h6 className="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-ink/60">
                Disparadas — {triggered.length}
              </h6>
              <AlertsTable rows={triggered} onDelete={(id) => deleteAlert.mutate(id)} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AlertsTable({ rows, onDelete }: { rows: ApiAlert[]; onDelete: (id: string) => void }) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr>
          <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Activo</th>
          <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Condición</th>
          <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Precio actual</th>
          <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Estado</th>
          <th className="p-1.5 border-b-2 border-divider" />
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const ccy = a.asset.currency as Currency;
          return (
            <tr key={a.id} className="hover:bg-ink/[0.04]">
              <td className="p-1.5 border-b border-divider">
                <span className="font-mono font-bold">{a.asset.yahoo_symbol}</span>
                <div className="text-muted text-[10.5px]">{a.asset.name}</div>
              </td>
              <td className="p-1.5 border-b border-divider whitespace-nowrap">
                {a.condition === "price_below" ? "Baja de" : "Sube de"} {formatCurrency(a.threshold, ccy)}
              </td>
              <td className="p-1.5 border-b border-divider text-right whitespace-nowrap">
                {a.current_price !== null ? formatCurrency(a.current_price, ccy) : "—"}
              </td>
              <td className="p-1.5 border-b border-divider whitespace-nowrap">
                {a.active ? (
                  <Tag variant="outline">Activa</Tag>
                ) : (
                  <Tag variant="accent">Disparada{a.triggered_at ? ` · ${formatDate(a.triggered_at)}` : ""}</Tag>
                )}
              </td>
              <td className="p-1.5 border-b border-divider text-right">
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  aria-label={`Eliminar alerta ${a.asset.yahoo_symbol}`}
                  className="text-ink/50 hover:text-accent-700 cursor-pointer"
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
