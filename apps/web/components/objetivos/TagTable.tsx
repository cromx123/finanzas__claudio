"use client";

import { useState } from "react";
import type { TagRow } from "../../lib/calc/goals";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ProgressBar } from "../ui/ProgressBar";
import { Tag } from "../ui/Tag";

export function TagTable({ rows, onCreateTag }: { rows: TagRow[]; onCreateTag: (name: string) => void }) {
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
            <th className="text-right text-[11px] uppercase text-ink/60 p-2 border-b-2 border-divider">% del ingreso pasivo</th>
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
              <td className="p-2 border-b border-divider text-right">{r.ingresoPctLabel}</td>
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
