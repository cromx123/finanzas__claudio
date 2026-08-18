import type { ApiMovement } from "../api/types";
import { todayStamp, triggerDownload } from "./download";

export const MOVEMENT_KIND_LABEL: Record<ApiMovement["kind"], string> = {
  buy: "Compra",
  sell: "Venta",
  dividend: "Abono",
};

const COLUMNS = [
  { key: "date", header: "Fecha", width: 14 },
  { key: "kind", header: "Tipo", width: 12 },
  { key: "portfolio_name", header: "Portafolio", width: 20 },
  { key: "yahoo_symbol", header: "Ticker", width: 12 },
  { key: "asset_name", header: "Activo", width: 26 },
  { key: "quantity", header: "Cantidad", width: 14 },
  { key: "price", header: "Precio/Monto por acción", width: 20 },
  { key: "total", header: "Total", width: 16 },
  { key: "currency", header: "Moneda", width: 10 },
] as const;

function toRow(m: ApiMovement): (string | number)[] {
  return [
    m.date,
    MOVEMENT_KIND_LABEL[m.kind],
    m.portfolio_name,
    m.yahoo_symbol,
    m.asset_name,
    m.quantity,
    m.price,
    m.total,
    m.currency,
  ];
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMovementsCsv(movements: ApiMovement[]) {
  const lines = [
    COLUMNS.map((c) => csvEscape(c.header)).join(","),
    ...movements.map((m) => toRow(m).map(csvEscape).join(",")),
  ];
  // Leading BOM so Excel opens the UTF-8 file with accents intact.
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `movimientos_${todayStamp()}.csv`);
}

export async function exportMovementsXlsx(movements: ApiMovement[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Movimientos");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  movements.forEach((m) => sheet.addRow({ ...m, kind: MOVEMENT_KIND_LABEL[m.kind] }));
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, `movimientos_${todayStamp()}.xlsx`);
}
