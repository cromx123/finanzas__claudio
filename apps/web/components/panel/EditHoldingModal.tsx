"use client";

import { useState } from "react";
import type { AssetType, Currency, HoldingMeta } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface EditHoldingModalProps {
  meta: HoldingMeta;
  ccy: Currency;
  onClose: () => void;
  onSave: (meta: HoldingMeta) => void;
  onDeleteAll: () => void;
}

const TIPOS: AssetType[] = ["Acción", "ETF", "REIT"];

export function EditHoldingModal({ meta, ccy, onClose, onSave, onDeleteAll }: EditHoldingModalProps) {
  const [form, setForm] = useState<HoldingMeta>(meta);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Modal title={`Editar ficha · ${meta.ticker}`} onClose={onClose}>
      <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as AssetType })}>
        {TIPOS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Input label="Etiqueta" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
      <Input label="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
      <Input label="País" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} />
      <Input
        label={`Precio actual (${ccy})`}
        type="number"
        value={form.precioActual}
        onChange={(e) => setForm({ ...form, precioActual: parseFloat(e.target.value) || 0 })}
      />
      <Input
        label={`Dividendo anual por acción (${ccy})`}
        type="number"
        value={form.dividendoAnualPorAccion}
        onChange={(e) => setForm({ ...form, dividendoAnualPorAccion: parseFloat(e.target.value) || 0 })}
      />

      <div className="flex justify-between items-center gap-2 mt-1 pt-3 border-t border-divider">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-accent-700">¿Eliminar todas las transacciones de {meta.ticker}?</span>
            <button type="button" className="text-accent-700 font-bold underline cursor-pointer" onClick={onDeleteAll}>
              Sí, eliminar
            </button>
            <button type="button" className="text-ink/60 underline cursor-pointer" onClick={() => setConfirmDelete(false)}>
              No
            </button>
          </div>
        ) : (
          <button type="button" className="text-accent-700 text-xs underline cursor-pointer" onClick={() => setConfirmDelete(true)}>
            Eliminar posición
          </button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onSave(form)}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
