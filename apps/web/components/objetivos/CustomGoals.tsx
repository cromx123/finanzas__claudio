"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useCreateCustomGoal, useDeleteCustomGoal, useUpdateCustomGoal } from "../../hooks/useApi";
import type { ApiCustomGoal } from "../../lib/api/types";
import { formatCurrency, formatDateEs, formatPercent } from "../../lib/format";
import type { Currency } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { ProgressBar } from "../ui/ProgressBar";

const CURRENCIES: Currency[] = ["CLP", "USD", "EUR", "JPY"];

interface DraftGoal {
  name: string;
  target_amount: number | "";
  currency: Currency;
  target_date: string;
}

const EMPTY_DRAFT: DraftGoal = { name: "", target_amount: "", currency: "CLP", target_date: "" };

/** Pace-projection message shown under the progress bar — pct/projected_date/
 * on_track are all computed server-side in goals.service.compute_progress
 * (envelope allocation + rate-since-created_at). Returns null when there
 * isn't enough data yet to say anything useful (goal created moments ago). */
function paceMessage(g: ApiCustomGoal): { text: string; className: string } | null {
  if (g.pct >= 100) return { text: "¡Meta lograda!", className: "text-ink/70" };
  if (g.on_track === false && !g.projected_date) {
    return { text: "Sin aportes desde que creaste esta meta — a este ritmo no la vas a alcanzar a tiempo.", className: "text-accent-700" };
  }
  if (!g.projected_date) return null;
  const dateText = formatDateEs(g.projected_date);
  if (g.on_track === true) return { text: `Vas a tiempo — a este ritmo la alcanzás el ${dateText}.`, className: "text-ink/70" };
  if (g.on_track === false) return { text: `Vas atrasado — a este ritmo la alcanzás recién el ${dateText}.`, className: "text-accent-700" };
  return { text: `A este ritmo, la alcanzás el ${dateText}.`, className: "text-muted" };
}

/**
 * User-named net-worth targets ("Viaje a Europa — $2M CLP") — the
 * kind=net_worth Goal rows that used to be modeled end-to-end (DB, schema)
 * but had no UI anywhere to create or see one. Each card's progress uses
 * the combined patrimonio (all portfolios) converted to the goal's own
 * currency, computed server-side in goals.service.compute_progress.
 */
export function CustomGoals({ goals }: { goals: ApiCustomGoal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftGoal>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const createGoal = useCreateCustomGoal();
  const updateGoal = useUpdateCustomGoal();
  const deleteGoal = useDeleteCustomGoal();

  const startCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (g: ApiCustomGoal) => {
    setEditingId(g.id);
    setDraft({ name: g.name, target_amount: g.target_amount, currency: g.currency as Currency, target_date: g.target_date ?? "" });
    setError(null);
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) return setError("Ponle un nombre a la meta.");
    if (!(typeof draft.target_amount === "number" && draft.target_amount > 0)) {
      return setError("Ingresa un monto mayor a 0.");
    }
    setError(null);
    const input = {
      name,
      target_amount: draft.target_amount,
      currency: draft.currency,
      target_date: draft.target_date || null,
    };
    try {
      if (editingId) {
        await updateGoal.mutateAsync({ id: editingId, input });
      } else {
        await createGoal.mutateAsync(input);
      }
      cancel();
    } catch {
      setError("No se pudo guardar la meta.");
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-3.5">
        <h6 className="m-0 text-[13px] uppercase tracking-[0.08em] font-sans font-extrabold">Tus metas</h6>
        {!showForm ? (
          <Button variant="secondary" className="text-xs ml-auto" onClick={startCreate}>
            <Plus size={14} strokeWidth={2} />
            Nueva meta
          </Button>
        ) : null}
      </div>

      {goals.length === 0 && !showForm ? (
        <p className="text-muted text-sm py-6 border-t border-divider">
          Todavía no tienes metas propias — creá una para algo específico (ej. "Viaje a Europa", "Fondo de emergencia").
        </p>
      ) : goals.length > 1 ? (
        <p className="text-muted text-[11.5px] mb-3">
          El patrimonio se reparte entre tus metas como sobres: la más antigua se financia primero hasta su monto meta,
          y lo que sobra pasa a la siguiente — por eso no todas muestran el 100% del patrimonio a la vez.
        </p>
      ) : null}
      {goals.length > 0 || showForm ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {goals.map((g) => {
            const ccy = g.currency as Currency;
            return (
              <div key={g.id} className="bg-surface px-[22px] py-5">
                <div className="flex items-start gap-2 mb-2">
                  <div className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent truncate">{g.name}</div>
                  <div className="ml-auto flex gap-1.5 flex-none">
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      aria-label={`Editar meta ${g.name}`}
                      className="text-ink/50 hover:text-accent cursor-pointer"
                    >
                      <Pencil size={13} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGoal.mutate(g.id)}
                      aria-label={`Eliminar meta ${g.name}`}
                      className="text-ink/50 hover:text-accent-700 cursor-pointer"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                <div className="flex items-baseline gap-2.5 mb-2.5">
                  <span className="font-sans font-extrabold text-[30px] tracking-[-0.01em]">{formatPercent(g.pct)}</span>
                  <span className="text-muted text-xs">
                    {formatCurrency(g.current_amount, ccy)} de {formatCurrency(g.target_amount, ccy)}
                  </span>
                </div>
                <ProgressBar percent={g.pct} color="accent" height={12} />
                {g.target_date ? <div className="text-muted text-[11px] mt-3">meta para {formatDateEs(g.target_date)}</div> : null}
                {(() => {
                  const pace = paceMessage(g);
                  return pace ? <div className={`text-[11px] mt-1.5 ${pace.className}`}>{pace.text}</div> : null;
                })()}
              </div>
            );
          })}
        </div>
      ) : null}

      {showForm ? (
        <div className="bg-surface px-5 py-4 flex flex-wrap items-end gap-2.5">
          <Input
            label="Nombre"
            placeholder="Ej: Viaje a Europa"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-[200px]"
          />
          <Input
            label="Monto meta"
            type="number"
            value={draft.target_amount}
            onChange={(e) => setDraft((d) => ({ ...d, target_amount: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
            className="w-[140px]"
          />
          <div className="field">
            <label className="block text-xs mb-1 text-ink/70">Moneda</label>
            <Select
              value={draft.currency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value as Currency }))}
              className="w-[100px]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Fecha meta (opcional)"
            type="date"
            value={draft.target_date}
            onChange={(e) => setDraft((d) => ({ ...d, target_date: e.target.value }))}
            className="w-[160px]"
          />
          <Button variant="primary" className="text-xs" onClick={submit} disabled={createGoal.isPending || updateGoal.isPending}>
            {editingId ? "Guardar" : "Crear"}
          </Button>
          <Button variant="secondary" className="text-xs" onClick={cancel}>
            <X size={14} strokeWidth={2} />
            Cancelar
          </Button>
          {error ? <p className="text-accent-700 text-xs w-full">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
