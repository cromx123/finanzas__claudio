"use client";

import { useState } from "react";
import type { ApiPortfolio } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";

const CURRENCIES: Currency[] = ["CLP", "USD", "EUR", "JPY"];

interface PortfolioFormModalProps {
  portfolio?: ApiPortfolio;
  onClose: () => void;
  onSave: (input: { name: string; currency: string }) => void;
  onDelete?: () => void;
}

export function PortfolioFormModal({ portfolio, onClose, onSave, onDelete }: PortfolioFormModalProps) {
  const [name, setName] = useState(portfolio?.name ?? "");
  const [currency, setCurrency] = useState<Currency>((portfolio?.currency as Currency) ?? "CLP");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Modal title={portfolio ? `Editar ${portfolio.name}` : "Nuevo portafolio"} onClose={onClose}>
      <Input label="Nombre" placeholder="Ej: Dividendos Chile" value={name} onChange={(e) => setName(e.target.value)} />
      {!portfolio && (
        <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      )}
      {portfolio ? <p className="text-muted text-xs">La moneda no se puede cambiar una vez creado el portafolio.</p> : null}

      <div className="flex justify-between items-center gap-2 mt-1 pt-3 border-t border-divider">
        {onDelete ? (
          confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-accent-700">¿Eliminar este portafolio y todas sus transacciones?</span>
              <button type="button" className="text-accent-700 font-bold underline cursor-pointer" onClick={onDelete}>
                Sí, eliminar
              </button>
              <button type="button" className="text-ink/60 underline cursor-pointer" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="text-accent-700 text-xs underline cursor-pointer" onClick={() => setConfirmDelete(true)}>
              Eliminar portafolio
            </button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => name.trim() && onSave({ name: name.trim(), currency })}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
