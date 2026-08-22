const TIPO_TO_TYPE: Record<string, "buy" | "sell"> = { Compra: "buy", Venta: "sell" };

export interface ParsedImportRow {
  line: number;
  portfolio_name: string;
  yahoo_symbol: string;
  type: "buy" | "sell";
  trade_date: string;
  quantity: number;
  price: number;
}

export interface ImportParseError {
  line: number;
  message: string;
}

export interface ParsedImportFile {
  rows: ParsedImportRow[];
  errors: ImportParseError[];
}

/** Minimal CSV cell splitter matching exportMovementsCsv's own escaping
 * (quotes a field only when it has a comma/quote/newline, doubling internal
 * quotes) — good enough since we control both sides of this format. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Parses the same template exportMovementsCsv generates (Fecha, Tipo,
 * Portafolio, Ticker, Cantidad, Precio…) — column order is matched by
 * header name, not position, so a spreadsheet re-save that reorders columns
 * still works. Abono rows are silently skipped: dividends aren't manually
 * created transactions in this app, so there's nothing to import for them.
 */
export function parseMovementsCsv(text: string): ParsedImportFile {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: [{ line: 0, message: "Archivo vacío." }] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const iFecha = header.indexOf("fecha");
  const iTipo = header.indexOf("tipo");
  const iPortafolio = header.indexOf("portafolio");
  const iTicker = header.indexOf("ticker");
  const iCantidad = header.indexOf("cantidad");
  const iPrecio = header.findIndex((h) => h.startsWith("precio"));

  const missing = [
    iFecha < 0 && "Fecha",
    iTipo < 0 && "Tipo",
    iPortafolio < 0 && "Portafolio",
    iTicker < 0 && "Ticker",
    iCantidad < 0 && "Cantidad",
    iPrecio < 0 && "Precio",
  ].filter((v): v is string => Boolean(v));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `Faltan columnas: ${missing.join(", ")}.` }] };
  }

  const rows: ParsedImportRow[] = [];
  const errors: ImportParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = parseCsvLine(lines[i]);
    const tipoRaw = (cells[iTipo] ?? "").trim();
    if (tipoRaw === "Abono") continue;

    const type = TIPO_TO_TYPE[tipoRaw];
    if (!type) {
      errors.push({ line: lineNumber, message: `Tipo "${tipoRaw}" no reconocido (usa Compra o Venta).` });
      continue;
    }

    const portfolio_name = (cells[iPortafolio] ?? "").trim();
    const yahoo_symbol = (cells[iTicker] ?? "").trim().toUpperCase();
    const trade_date = (cells[iFecha] ?? "").trim();
    const quantity = parseFloat(cells[iCantidad] ?? "");
    const price = parseFloat(cells[iPrecio] ?? "");

    if (!portfolio_name || !yahoo_symbol || !/^\d{4}-\d{2}-\d{2}$/.test(trade_date) || !(quantity > 0) || !(price > 0)) {
      errors.push({ line: lineNumber, message: "Fila incompleta o inválida (revisa fecha, cantidad y precio)." });
      continue;
    }

    rows.push({ line: lineNumber, portfolio_name, yahoo_symbol, type, trade_date, quantity, price });
  }

  return { rows, errors };
}
