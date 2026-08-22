"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { TagRow } from "../../lib/calc/goals";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ProgressBar } from "../ui/ProgressBar";
import { Tag } from "../ui/Tag";

const REBALANCE_TAG_VARIANT: Record<NonNullable<TagRow["rebalanceStatus"]>, "accent" | "neutral" | "outline"> = {
  over: "accent",
  under: "accent",
  on: "outline",
};

function TargetWeightInput({ row, onSetTargetWeight }: { row: TagRow; onSetTargetWeight: (name: string, value: number | null) => void }) {
  const [draft, setDraft] = useState(row.targetWeight === null ? "" : String(row.targetWeight));

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (row.targetWeight !== null) onSetTargetWeight(row.name, null);
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isNaN(parsed) && parsed !== row.targetWeight) onSetTargetWeight(row.name, Math.min(100, Math.max(0, parsed)));
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        placeholder="—"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-[70px] min-h-0 py-1 text-right"
      />
      <span className="text-muted text-xs">%</span>
    </div>
  );
}

export function TagTable({
  rows,
  onCreateTag,
  onDeleteTag,
  onSetTargetWeight,
}: {
  rows: TagRow[];
  onCreateTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onSetTargetWeight: (name: string, value: number | null) => void;
}) {
  const [newTag, setNewTag] = useState("");
  return (
    <div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Etiqueta</th>
            <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Activos</th>
            <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Valor</th>
            <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Peso</th>
            <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Peso objetivo</th>
            <th className="text-left text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">Estado</th>
            <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">% del ingreso pasivo</th>
            <th className="p-2 border-b-2 border-divider" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="p-2 border-b border-divider">
                <Tag variant="neutral" className="text-[10.5px]">
                  {r.name}
                </Tag>
              </td>
              <td className="p-2 border-b border-divider text-right">{r.count}</td>
              <td className="p-2 border-b border-divider text-right font-bold">{r.valorLabel}</td>
              <td className="p-2 border-b border-divider">
                <div className="flex items-center gap-2">
                  <ProgressBar percent={r.widthPct} height={8} className="w-[90px]" />
                  <span className="text-xs">{r.pesoLabel}</span>
                </div>
              </td>
              <td className="p-2 border-b border-divider">
                <TargetWeightInput row={r} onSetTargetWeight={onSetTargetWeight} />
              </td>
              <td className="p-2 border-b border-divider whitespace-nowrap">
                {r.rebalanceStatus ? (
                  <Tag variant={REBALANCE_TAG_VARIANT[r.rebalanceStatus]} className="text-[10px]">
                    {r.rebalanceLabel}
                  </Tag>
                ) : (
                  <span className="text-muted text-xs">—</span>
                )}
              </td>
              <td className="p-2 border-b border-divider text-right">{r.ingresoPctLabel}</td>
              <td className="p-2 border-b border-divider text-right">
                <button
                  type="button"
                  onClick={() => onDeleteTag(r.name)}
                  aria-label={`Eliminar etiqueta ${r.name}`}
                  className="text-ink/50 hover:text-accent-700 cursor-pointer"
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3.5">
        <Input
          placeholder="Nueva etiqueta… (ej: Small Caps)"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="max-w-[240px] min-h-8"
        />
        <Button
          variant="secondary"
          className="text-xs"
          onClick={() => {
            const n = newTag.trim();
            if (n) {
              onCreateTag(n);
              setNewTag("");
            }
          }}
        >
          + Crear etiqueta
        </Button>
      </div>
    </div>
  );
}
