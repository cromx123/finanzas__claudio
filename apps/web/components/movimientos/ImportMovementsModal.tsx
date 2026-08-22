"use client";

import { useRef, useState } from "react";
import { useImportTransactions } from "../../hooks/useApi";
import { MOVEMENT_KIND_LABEL } from "../../lib/export/movements";
import { parseMovementsCsv, type ParsedImportFile } from "../../lib/import/movements";
import type { ApiTransactionImportRowResult } from "../../lib/api/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const TYPE_LABEL: Record<"buy" | "sell", string> = { buy: MOVEMENT_KIND_LABEL.buy, sell: MOVEMENT_KIND_LABEL.sell };

/**
 * Bulk-import Compra/Venta rows from the same CSV template
 * exportMovementsCsv generates — Abono rows are skipped (dividends aren't
 * manually created transactions here). Parses client-side for an instant
 * preview, then submits the whole batch in one request; the backend
 * processes each row independently so one bad row never blocks the rest.
 */
export function ImportMovementsModal({ onClose }: { onClose: () => void }) {
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<ApiTransactionImportRowResult[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importTransactions = useImportTransactions();

  const handleFile = async (file: File) => {
    setResults(null);
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseMovementsCsv(text));
  };

  const submit = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    const rows = parsed.rows.map(({ portfolio_name, yahoo_symbol, type, trade_date, quantity, price }) => ({
      portfolio_name,
      yahoo_symbol,
      type,
      trade_date,
      quantity,
      price,
    }));
    const resp = await importTransactions.mutateAsync(rows);
    setResults(resp.results);
  };

  const reset = () => {
    setParsed(null);
    setFileName("");
    setResults(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const okCount = results?.filter((r) => r.status === "ok").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <Modal title="Importar movimientos" onClose={onClose} width={560}>
      <p className="text-[13px] text-ink/80 leading-relaxed">
        Usa el mismo formato del botón "Exportar CSV" (Fecha, Tipo, Portafolio, Ticker, Cantidad, Precio). Solo se
        importan filas de <b>Compra</b> o <b>Venta</b> — los Abonos no son transacciones editables. Las ventas usan
        FIFO por defecto.
      </p>

      {!results ? (
        <>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="text-[13px]"
          />

          {parsed ? (
            <div className="mt-2">
              <p className="text-[12.5px] text-ink/70 mb-2">
                {fileName}: {parsed.rows.length} fila(s) lista(s) para importar
                {parsed.errors.length > 0 ? `, ${parsed.errors.length} con error` : ""}.
              </p>

              {parsed.errors.length > 0 ? (
                <div className="max-h-[120px] overflow-y-auto border border-divider p-2 mb-3 bg-surface">
                  {parsed.errors.map((e, i) => (
                    <div key={i} className="text-accent-700 text-[11.5px]">
                      Línea {e.line}: {e.message}
                    </div>
                  ))}
                </div>
              ) : null}

              {parsed.rows.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto border border-divider">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="text-left p-1.5 border-b border-divider">Fecha</th>
                        <th className="text-left p-1.5 border-b border-divider">Tipo</th>
                        <th className="text-left p-1.5 border-b border-divider">Portafolio</th>
                        <th className="text-left p-1.5 border-b border-divider">Ticker</th>
                        <th className="text-right p-1.5 border-b border-divider">Cantidad</th>
                        <th className="text-right p-1.5 border-b border-divider">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 20).map((r) => (
                        <tr key={r.line}>
                          <td className="p-1.5 border-b border-divider">{r.trade_date}</td>
                          <td className="p-1.5 border-b border-divider">{TYPE_LABEL[r.type]}</td>
                          <td className="p-1.5 border-b border-divider">{r.portfolio_name}</td>
                          <td className="p-1.5 border-b border-divider font-mono">{r.yahoo_symbol}</td>
                          <td className="p-1.5 border-b border-divider text-right">{r.quantity}</td>
                          <td className="p-1.5 border-b border-divider text-right">{r.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > 20 ? (
                    <p className="text-muted text-[11px] p-1.5">…y {parsed.rows.length - 20} fila(s) más.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2 mt-2">
            <Button
              variant="primary"
              className="text-xs"
              disabled={!parsed || parsed.rows.length === 0 || importTransactions.isPending}
              onClick={submit}
            >
              {importTransactions.isPending ? "Importando…" : `Importar ${parsed?.rows.length ?? 0} fila(s)`}
            </Button>
            <Button variant="secondary" className="text-xs" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <div>
          <p className="text-[13px] mb-3">
            {okCount} fila(s) importada(s){errorCount > 0 ? `, ${errorCount} con error` : ""}.
          </p>
          {errorCount > 0 ? (
            <div className="max-h-[160px] overflow-y-auto border border-divider p-2 mb-3 bg-surface">
              {results
                .filter((r) => r.status === "error")
                .map((r) => (
                  <div key={r.row} className="text-accent-700 text-[11.5px]">
                    Fila {parsed && parsed.rows[r.row] ? parsed.rows[r.row].line : r.row + 1}: {r.message}
                  </div>
                ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs" onClick={reset}>
              Importar otro archivo
            </Button>
            <Button variant="primary" className="text-xs" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
