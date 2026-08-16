"use client";

import { Trash2 } from "lucide-react";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { ApiTransaction } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { Modal } from "../ui/Modal";
import { Tag } from "../ui/Tag";

export function TransactionHistoryModal({
  transactions,
  ccy,
  decimalesPrecio,
  onClose,
  onDelete,
}: {
  transactions: ApiTransaction[];
  ccy: Currency;
  decimalesPrecio: number;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...transactions].sort((a, b) => b.trade_date.localeCompare(a.trade_date));

  return (
    <Modal title="Historial de transacciones" onClose={onClose} width={560}>
      {sorted.length === 0 ? (
        <p className="text-muted text-sm">Todavía no hay transacciones en esta cartera.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Fecha</th>
                <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Activo</th>
                <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Tipo</th>
                <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Cantidad</th>
                <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Precio</th>
                <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Monto</th>
                <th className="p-1.5 border-b-2 border-divider" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => (
                <tr key={tx.id}>
                  <td className="p-1.5 border-b border-divider whitespace-nowrap">{tx.trade_date}</td>
                  <td className="p-1.5 border-b border-divider font-mono font-bold">{tx.asset.yahoo_symbol}</td>
                  <td className="p-1.5 border-b border-divider">
                    <Tag variant={tx.type === "buy" ? "neutral" : "outline"} className="text-[9.5px] px-1.5">
                      {tx.type === "buy" ? "Compra" : "Venta"}
                    </Tag>
                  </td>
                  <td className="p-1.5 border-b border-divider text-right">{formatNumber(tx.quantity)}</td>
                  <td className="p-1.5 border-b border-divider text-right">{formatCurrency(tx.price, ccy, decimalesPrecio)}</td>
                  <td className="p-1.5 border-b border-divider text-right font-bold">{formatCurrency(tx.gross_amount, ccy)}</td>
                  <td className="p-1.5 border-b border-divider text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(tx.id)}
                      aria-label={`Eliminar transacción ${tx.asset.yahoo_symbol}`}
                      className="text-ink/50 hover:text-accent-700 cursor-pointer"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
