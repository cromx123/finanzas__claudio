"use client";

import type { ComparadorParams } from "../../lib/types";
import { Input, Select } from "../ui/Input";
import { ToggleButton } from "../ui/ToggleButton";

interface ComparadorControlsProps {
  params: ComparadorParams;
  onChange: (p: ComparadorParams) => void;
  options: { value: string; label: string }[];
}

export function ComparadorControls({ params, onChange, options }: ComparadorControlsProps) {
  return (
    <div className="flex items-end gap-5 flex-wrap border-y-2 border-divider py-3.5">
      <div className="field min-w-[210px]">
        <label className="block text-xs mb-1 text-ink/70">
          <span className="inline-block w-[9px] h-[9px] bg-ink mr-1.5" />
          Activo A
        </label>
        <Select value={params.activoA} onChange={(e) => onChange({ ...params, activoA: e.target.value })}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="field min-w-[210px]">
        <label className="block text-xs mb-1 text-ink/70">
          <span className="inline-block w-[9px] h-[9px] bg-accent mr-1.5" />
          Activo B
        </label>
        <Select value={params.activoB} onChange={(e) => onChange({ ...params, activoB: e.target.value })}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[120px]">
        <Input
          label="Inversión inicial"
          type="number"
          defaultValue={params.inversionInicial}
          onChange={(e) => onChange({ ...params, inversionInicial: Math.max(0, parseFloat(e.target.value) || 0) })}
        />
      </div>
      <div className="w-[110px]">
        <Input
          label="Aporte mensual"
          type="number"
          defaultValue={params.aporteMensual}
          onChange={(e) => onChange({ ...params, aporteMensual: Math.max(0, parseFloat(e.target.value) || 0) })}
        />
      </div>
      <div className="w-[120px]">
        <Input
          label="Costo de vida/mes"
          type="number"
          defaultValue={params.costoVidaMensual}
          onChange={(e) => onChange({ ...params, costoVidaMensual: Math.max(0, parseFloat(e.target.value) || 0) })}
        />
      </div>
      <div className="w-[90px]">
        <Input
          label="Inflación %"
          type="number"
          step={0.5}
          defaultValue={params.inflacionAnual}
          onChange={(e) => onChange({ ...params, inflacionAnual: Math.max(0, parseFloat(e.target.value) || 0) })}
        />
      </div>
      <div className="w-[190px]">
        <label className="block text-xs mb-1 text-ink/70">
          Horizonte: {params.horizonteAnios} años · {new Date().getFullYear()}–{new Date().getFullYear() + params.horizonteAnios}
        </label>
        <input
          type="range"
          min={5}
          max={30}
          step={1}
          value={params.horizonteAnios}
          onChange={(e) => onChange({ ...params, horizonteAnios: parseInt(e.target.value, 10) })}
          className="w-full h-[34px]"
        />
      </div>
      <ToggleButton active={params.drip} onClick={() => onChange({ ...params, drip: !params.drip })}>
        DRIP · reinversión
      </ToggleButton>
    </div>
  );
}
