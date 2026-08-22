"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useCreateAlert, useDeleteAlert } from "../../hooks/useApi";
import type { AlertCondition, ApiAlert } from "../../lib/api/types";
import { formatCurrency, formatDateEs, formatDecimal } from "../../lib/format";
import type { Currency } from "../../lib/types";
import { TickerAutocomplete } from "../shared/TickerAutocomplete";
import { Button } from "../ui/Button";
import { HelpButton } from "../ui/HelpButton";
import { Input } from "../ui/Input";
import { MoneyInput } from "../ui/MoneyInput";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Tag } from "../ui/Tag";

type IndicatorKind = "price" | "rsi" | "bollinger";
type Direction = "below" | "above";

// Pocket-glossary content for "¿Por qué esta alerta?" — shown both while
// picking an indicator (contextual to the current choice) and next to each
// existing alert (keyed off its condition), so a beginner never has to
// leave the panel to understand what RSI or Bollinger actually mean.
const INDICATOR_EXPLAINERS: Record<IndicatorKind, { title: string; body: React.ReactNode }> = {
  price: {
    title: "Alerta de precio",
    body: (
      <p>
        Se dispara cuando el precio de cierre cruza el umbral que definiste — no mira nada más. Es la alerta más
        simple: útil para un nivel de entrada o salida que ya tenés en mente.
      </p>
    ),
  },
  rsi: {
    title: "RSI · Índice de Fuerza Relativa",
    body: (
      <>
        <p>
          Mide qué tan rápido y cuánto subió o bajó el precio en los últimos días (el "período"), en una escala de 0
          a 100.
        </p>
        <p>
          Por convención, un RSI bajo 30 sugiere sobreventa (posible rebote); sobre 70, sobrecompra (posible
          corrección). No es garantía — es una señal de que el movimiento reciente fue inusualmente fuerte.
        </p>
      </>
    ),
  },
  bollinger: {
    title: "Bandas de Bollinger",
    body: (
      <>
        <p>
          Miden la volatilidad reciente del precio: dibujan una banda alrededor del promedio móvil, más ancha cuando
          el precio se mueve mucho y más angosta cuando está tranquilo.
        </p>
        <p>
          Si el precio toca la banda inferior, se alejó más de lo habitual hacia abajo — podría rebotar. Si toca la
          banda superior, se alejó hacia arriba — podría corregir.
        </p>
      </>
    ),
  },
};

function indicatorKindOf(condition: AlertCondition): IndicatorKind {
  if (condition === "price_below" || condition === "price_above") return "price";
  if (condition === "rsi_below" || condition === "rsi_above") return "rsi";
  return "bollinger";
}

const INDICATOR_OPTIONS: { label: string; value: IndicatorKind }[] = [
  { label: "Precio", value: "price" },
  { label: "RSI", value: "rsi" },
  { label: "Bollinger", value: "bollinger" },
];

// Same below/above axis for all three indicators, only the label changes:
// "below $X" for price, "RSI falls below N" for RSI, "touches the lower/
// upper band" for Bollinger (no number there — it's a band cross).
const DIRECTION_LABELS: Record<IndicatorKind, Record<Direction, string>> = {
  price: { below: "Baja de", above: "Sube de" },
  rsi: { below: "Cae bajo", above: "Sube sobre" },
  bollinger: { below: "Banda inferior", above: "Banda superior" },
};

function buildCondition(indicator: IndicatorKind, direction: Direction): AlertCondition {
  if (indicator === "price") return direction === "below" ? "price_below" : "price_above";
  if (indicator === "rsi") return direction === "below" ? "rsi_below" : "rsi_above";
  return direction === "below" ? "bollinger_lower_cross" : "bollinger_upper_cross";
}

function describeCondition(a: ApiAlert, ccy: Currency): string {
  switch (a.condition) {
    case "price_below":
      return `Baja de ${formatCurrency(a.threshold ?? 0, ccy)}`;
    case "price_above":
      return `Sube de ${formatCurrency(a.threshold ?? 0, ccy)}`;
    case "rsi_below":
      return `RSI cae bajo ${a.threshold}`;
    case "rsi_above":
      return `RSI sube sobre ${a.threshold}`;
    case "bollinger_lower_cross":
      return `Toca banda inferior de Bollinger (${a.params.period ?? 20}, ${a.params.stddev ?? 2}σ)`;
    case "bollinger_upper_cross":
      return `Toca banda superior de Bollinger (${a.params.period ?? 20}, ${a.params.stddev ?? 2}σ)`;
  }
}

function describeCurrentValue(a: ApiAlert, ccy: Currency): string {
  if (a.current_value === null) return "—";
  if (a.condition === "rsi_below" || a.condition === "rsi_above") return `RSI ${formatDecimal(a.current_value)}`;
  return formatCurrency(a.current_value, ccy);
}

export function AlertsPanel({ alerts, isLoading }: { alerts: ApiAlert[]; isLoading: boolean }) {
  const [ticker, setTicker] = useState("");
  const [indicator, setIndicator] = useState<IndicatorKind>("price");
  const [direction, setDirection] = useState<Direction>("below");
  const [threshold, setThreshold] = useState<number | "">("");
  const [period, setPeriod] = useState<number | "">("");
  const [stddev, setStddev] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();

  const needsThreshold = indicator !== "bollinger";

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return setError("Ingresa un ticker.");
    if (needsThreshold && !(typeof threshold === "number" && threshold > 0)) {
      return setError(indicator === "rsi" ? "Ingresa un nivel de RSI mayor a 0." : "Ingresa un precio mayor a 0.");
    }
    setError(null);

    const params: Record<string, number> = {};
    if (indicator === "rsi" && typeof period === "number") params.period = period;
    if (indicator === "bollinger") {
      if (typeof period === "number") params.period = period;
      if (typeof stddev === "number") params.stddev = stddev;
    }

    try {
      await createAlert.mutateAsync({
        yahoo_symbol: t,
        condition: buildCondition(indicator, direction),
        threshold: needsThreshold && typeof threshold === "number" ? threshold : undefined,
        params,
      });
      setTicker("");
      setThreshold("");
      setPeriod("");
      setStddev("");
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
        <TickerAutocomplete
          label="Ticker"
          placeholder="Ej: CHILE.SN, AAPL"
          value={ticker}
          onChange={setTicker}
          className="w-[160px]"
        />
        <div className="field">
          <label className="block text-xs mb-1 text-ink/70">Indicador</label>
          <div className="flex items-center gap-1.5">
            <SegmentedControl options={INDICATOR_OPTIONS} value={indicator} onChange={setIndicator} size="compact" />
            <HelpButton title={INDICATOR_EXPLAINERS[indicator].title}>{INDICATOR_EXPLAINERS[indicator].body}</HelpButton>
          </div>
        </div>
        <div className="field">
          <label className="block text-xs mb-1 text-ink/70">Condición</label>
          <SegmentedControl
            options={[
              { label: DIRECTION_LABELS[indicator].below, value: "below" as const },
              { label: DIRECTION_LABELS[indicator].above, value: "above" as const },
            ]}
            value={direction}
            onChange={setDirection}
            size="compact"
          />
        </div>
        {indicator === "price" ? (
          <MoneyInput label="Precio" value={threshold} onChange={setThreshold} className="w-[120px]" />
        ) : indicator === "rsi" ? (
          <>
            <Input
              label="Nivel RSI"
              type="number"
              placeholder="30"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="w-[90px]"
            />
            <Input
              label="Período"
              type="number"
              placeholder="14"
              value={period}
              onChange={(e) => setPeriod(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="w-[80px]"
            />
          </>
        ) : (
          <>
            <Input
              label="Período"
              type="number"
              placeholder="20"
              value={period}
              onChange={(e) => setPeriod(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="w-[80px]"
            />
            <Input
              label="Desv. estándar"
              type="number"
              placeholder="2"
              value={stddev}
              onChange={(e) => setStddev(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="w-[100px]"
            />
          </>
        )}
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Activo</th>
            <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Condición</th>
            <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Valor actual</th>
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
                  <span className="inline-flex items-center gap-1.5">
                    {describeCondition(a, ccy)}
                    <HelpButton
                      title={INDICATOR_EXPLAINERS[indicatorKindOf(a.condition)].title}
                      className="[&_button]:w-[18px] [&_button]:h-[18px]"
                    >
                      {INDICATOR_EXPLAINERS[indicatorKindOf(a.condition)].body}
                    </HelpButton>
                  </span>
                </td>
                <td className="p-1.5 border-b border-divider text-right whitespace-nowrap">{describeCurrentValue(a, ccy)}</td>
                <td className="p-1.5 border-b border-divider whitespace-nowrap">
                  {a.active ? (
                    <Tag variant="outline">Activa</Tag>
                  ) : (
                    <Tag variant="accent">Disparada{a.triggered_at ? ` · ${formatDateEs(a.triggered_at)}` : ""}</Tag>
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
    </div>
  );
}
