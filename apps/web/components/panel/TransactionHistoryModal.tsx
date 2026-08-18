"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { ApiTransaction } from "../../lib/api/types";
import type { Currency } from "../../lib/types";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Tag } from "../ui/Tag";

type TipoFilter = "*" | "buy" | "sell";
type SortKey = "fecha" | "monto";

const TIPO_OPTIONS: { label: string; value: TipoFilter }[] = [
  { label: "Todos", value: "*" },
  { label: "Compras", value: "buy" },
  { label: "Ventas", value: "sell" },
];

interface EditDraft {
  trade_date: string;
  quantity: string;
  price: string;
}

function SortArrow({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return null;
  return <span> {dir < 0 ? "▼" : "▲"}</span>;
}

export function TransactionHistoryModal({
  transactions,
  ccy,
  decimalesPrecio,
  onClose,
  onUpdate,
  onDelete,
}: {
  transactions: ApiTransaction[];
  ccy: Currency;
  decimalesPrecio: number;
  onClose: () => void;
  onUpdate: (id: string, input: { trade_date: string; quantity: number; price: number }) => Promise<void> | void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("*");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ trade_date: "", quantity: "", price: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleSort = (key: SortKey) => {
    setSortDir((d) => (sortKey === key ? ((-d) as 1 | -1) : -1));
    setSortKey(key);
  };

  const startEdit = (tx: ApiTransaction) => {
    setEditingId(tx.id);
    setDraft({ trade_date: tx.trade_date, quantity: String(tx.quantity), price: String(tx.price) });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    const quantity = parseFloat(draft.quantity);
    const price = parseFloat(draft.price);
    if (!draft.trade_date) return setEditError("Ingresa una fecha.");
    if (!(quantity > 0)) return setEditError("La cantidad debe ser mayor a 0.");
    if (!(price > 0)) return setEditError("El precio debe ser mayor a 0.");
    setEditError(null);
    setSaving(true);
    try {
      await onUpdate(editingId as string, { trade_date: draft.trade_date, quantity, price });
      setEditingId(null);
    } catch {
      setEditError("No se pudo guardar — revisa que la cantidad no supere lo disponible.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions.filter(
      (tx) =>
        (tipoFilter === "*" || tx.type === tipoFilter) &&
        (!needle || tx.asset.yahoo_symbol.toLowerCase().includes(needle) || tx.asset.name.toLowerCase().includes(needle))
    );
  }, [transactions, q, tipoFilter]);

  const sorted = useMemo(() => {
    const key = sortKey === "fecha" ? "trade_date" : "gross_amount";
    return [...filtered].sort((a, b) => sortDir * (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
  }, [filtered, sortKey, sortDir]);

  const totalCompras = filtered.filter((tx) => tx.type === "buy").reduce((sum, tx) => sum + tx.gross_amount, 0);
  const totalVentas = filtered.filter((tx) => tx.type === "sell").reduce((sum, tx) => sum + tx.gross_amount, 0);

  return (
    <Modal title="Historial de transacciones" onClose={onClose} width={680}>
      {transactions.length === 0 ? (
        <p className="text-muted text-sm">Todavía no hay transacciones en esta cartera.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Buscar ticker o nombre…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-[220px]"
            />
            <SegmentedControl options={TIPO_OPTIONS} value={tipoFilter} onChange={setTipoFilter} size="compact" />
            <span className="text-muted text-[11px] ml-auto">
              {sorted.length} de {transactions.length} · Compras {formatCurrency(totalCompras, ccy)} · Ventas {formatCurrency(totalVentas, ccy)}
            </span>
          </div>

          {sorted.length === 0 ? (
            <p className="text-muted text-sm py-6 border-t border-divider">Ninguna transacción coincide con el filtro.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th
                      className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort("fecha")}
                    >
                      Fecha
                      <SortArrow active={sortKey === "fecha"} dir={sortDir} />
                    </th>
                    <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Activo</th>
                    <th className="text-left text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Tipo</th>
                    <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Cantidad</th>
                    <th className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider">Precio</th>
                    <th
                      className="text-right text-[10.5px] uppercase text-ink/60 p-1.5 border-b-2 border-divider cursor-pointer select-none"
                      onClick={() => toggleSort("monto")}
                    >
                      Monto
                      <SortArrow active={sortKey === "monto"} dir={sortDir} />
                    </th>
                    <th className="p-1.5 border-b-2 border-divider" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx) => {
                    const isEditing = editingId === tx.id;
                    const draftAmount = isEditing ? parseFloat(draft.quantity) * parseFloat(draft.price) : null;
                    return (
                      <tr key={tx.id} className="hover:bg-ink/[0.04]">
                        <td className="p-1.5 border-b border-divider whitespace-nowrap">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={draft.trade_date}
                              onChange={(e) => setDraft((d) => ({ ...d, trade_date: e.target.value }))}
                              className="min-h-0 py-1 text-[12px]"
                            />
                          ) : (
                            tx.trade_date
                          )}
                        </td>
                        <td className="p-1.5 border-b border-divider">
                          <span className="font-mono font-bold">{tx.asset.yahoo_symbol}</span>
                          <div className="text-muted text-[10.5px]">{tx.asset.name}</div>
                        </td>
                        <td className="p-1.5 border-b border-divider">
                          <Tag variant={tx.type === "buy" ? "neutral" : "outline"} className="text-[9.5px] px-1.5">
                            {tx.type === "buy" ? "Compra" : "Venta"}
                          </Tag>
                        </td>
                        <td className="p-1.5 border-b border-divider text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={draft.quantity}
                              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                              className="min-h-0 py-1 text-[12px] text-right w-[90px] ml-auto"
                            />
                          ) : (
                            formatNumber(tx.quantity)
                          )}
                        </td>
                        <td className="p-1.5 border-b border-divider text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={draft.price}
                              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                              className="min-h-0 py-1 text-[12px] text-right w-[90px] ml-auto"
                            />
                          ) : (
                            formatCurrency(tx.price, ccy, decimalesPrecio)
                          )}
                        </td>
                        <td className="p-1.5 border-b border-divider text-right font-bold">
                          {isEditing
                            ? draftAmount !== null && !Number.isNaN(draftAmount)
                              ? formatCurrency(draftAmount, ccy)
                              : "—"
                            : formatCurrency(tx.gross_amount, ccy)}
                        </td>
                        <td className="p-1.5 border-b border-divider text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  disabled={saving}
                                  aria-label="Guardar cambios"
                                  className="text-ink/50 hover:text-accent cursor-pointer disabled:opacity-40"
                                >
                                  <Check size={14} strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  aria-label="Cancelar edición"
                                  className="text-ink/50 hover:text-accent-700 cursor-pointer disabled:opacity-40"
                                >
                                  <X size={14} strokeWidth={2} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(tx)}
                                  aria-label={`Editar transacción ${tx.asset.yahoo_symbol}`}
                                  className="text-ink/50 hover:text-accent cursor-pointer"
                                >
                                  <Pencil size={14} strokeWidth={1.8} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(tx.id)}
                                  aria-label={`Eliminar transacción ${tx.asset.yahoo_symbol}`}
                                  className="text-ink/50 hover:text-accent-700 cursor-pointer"
                                >
                                  <Trash2 size={14} strokeWidth={1.8} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {editError ? <p className="text-accent-700 text-xs mt-2">{editError}</p> : null}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
