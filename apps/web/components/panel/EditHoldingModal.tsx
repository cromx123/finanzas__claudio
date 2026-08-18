"use client";

import { useState } from "react";
import { formatCurrency, formatPercent } from "../../lib/format";
import type { ApiHolding } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface EditHoldingModalProps {
  holding: ApiHolding;
  onClose: () => void;
  onDeleteAll: () => void;
}

export function EditHoldingModal({ holding, onClose, onDeleteAll }: EditHoldingModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ccy = holding.asset.currency as Currency;

  return (
    <Modal title={`Ficha · ${holding.asset.yahoo_symbol}`} onClose={onClose}>
      <div className="text-sm">
        <div className="font-bold">{holding.asset.name}</div>
        <div className="text-muted text-xs">
          {holding.asset.type} · {holding.asset.sector ?? "Sin sector"} · {holding.asset.country}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted uppercase tracking-wide text-[10px]">Precio actual</div>
          <b>{formatCurrency(holding.price, ccy)}</b>
          {holding.price_is_stale ? <span className="text-accent-700 ml-1">(EOD)</span> : null}
        </div>
        <div>
          <div className="text-muted uppercase tracking-wide text-[10px]">Dividendo anual/acción</div>
          <b>{formatCurrency(holding.dividend_per_share_ttm, ccy)}</b>
        </div>
        <div>
          <div className="text-muted uppercase tracking-wide text-[10px]">Yield on cost</div>
          <b>{formatPercent(holding.yield_on_cost * 100)}</b>
        </div>
        <div>
          <div className="text-muted uppercase tracking-wide text-[10px]">Costo promedio</div>
          <b>{formatCurrency(holding.avg_cost, ccy)}</b>
        </div>
      </div>
      <p className="text-muted text-[11px]">Precio y dividendo vienen de datos reales de mercado — no son editables aquí.</p>

      <div className="flex justify-between items-center gap-2 mt-1 pt-3 border-t border-divider">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-accent-700">¿Eliminar todas las transacciones de {holding.asset.yahoo_symbol}?</span>
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
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      </div>
    </Modal>
  );
}
