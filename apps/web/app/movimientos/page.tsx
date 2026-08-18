"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { HelpButton } from "../../components/ui/HelpButton";
import { NavBar } from "../../components/layout/NavBar";
import { PageContainer, PageFooter, PageHeader } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Tag } from "../../components/ui/Tag";
import { useMovements, usePortfolios } from "../../hooks/useApi";
import { exportMovementsCsv, exportMovementsXlsx, MOVEMENT_KIND_LABEL } from "../../lib/export/movements";
import { formatCurrency, formatNumber } from "../../lib/format";
import type { ApiMovement } from "../../lib/api/types";
import type { Currency } from "../../lib/types";

type KindFilter = "all" | ApiMovement["kind"];

const KIND_OPTIONS: { label: string; value: KindFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Compras", value: "buy" },
  { label: "Ventas", value: "sell" },
  { label: "Abonos", value: "dividend" },
];

const KIND_TAG_VARIANT: Record<ApiMovement["kind"], "neutral" | "outline" | "accent"> = {
  buy: "neutral",
  sell: "outline",
  dividend: "accent",
};

export default function MovimientosPage() {
  const { data: portfolios } = usePortfolios();
  const { data: movements, isLoading } = useMovements();
  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const filtered = useMemo(() => {
    if (!movements) return [];
    return movements.filter(
      (m) => (portfolioFilter === "all" || m.portfolio_id === portfolioFilter) && (kindFilter === "all" || m.kind === kindFilter)
    );
  }, [movements, portfolioFilter, kindFilter]);

  return (
    <>
      <NavBar right={<span className="text-muted text-xs">{filtered.length} movimientos</span>} />
      <PageContainer>
        <PageHeader
          kicker="MOVIMIENTOS"
          title="Compras, ventas y abonos"
          aside="todos tus portafolios · exportable a CSV o Excel"
          help={
            <HelpButton title="Movimientos">
              <p className="mb-2">
                Ledger único con cada <b>compra</b>, <b>venta</b> y <b>abono</b> (dividendo ya pagado) de todos tus portafolios.
              </p>
              <p className="mb-2">Filtra por portafolio o tipo de movimiento con los controles de arriba.</p>
              <p>Los botones “Exportar” descargan exactamente lo que ves filtrado, en CSV o Excel.</p>
            </HelpButton>
          }
        />

        <div className="flex items-end gap-4 flex-wrap border-y-2 border-divider py-4 mb-6">
          <Select
            label="Portafolio"
            value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
            className="w-auto min-w-[180px]"
          >
            <option value="all">Todos los portafolios</option>
            {(portfolios ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div>
            <div className="text-xs mb-1 text-ink/70">Tipo</div>
            <SegmentedControl options={KIND_OPTIONS} value={kindFilter} onChange={setKindFilter} size="compact" />
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              disabled={filtered.length === 0}
              onClick={() => exportMovementsCsv(filtered)}
            >
              <Download size={14} strokeWidth={1.8} />
              Exportar CSV
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={filtered.length === 0 || exporting !== null}
              onClick={async () => {
                setExporting("xlsx");
                try {
                  await exportMovementsXlsx(filtered);
                } finally {
                  setExporting(null);
                }
              }}
            >
              <Download size={14} strokeWidth={1.8} />
              {exporting === "xlsx" ? "Generando…" : "Exportar Excel"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted text-sm py-6">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm py-6">No hay movimientos que calcen con el filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Fecha</th>
                  <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Tipo</th>
                  <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Portafolio</th>
                  <th className="text-left text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Activo</th>
                  <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Cantidad</th>
                  <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Precio</th>
                  <th className="text-right text-[11px] tracking-[0.08em] uppercase text-ink/60 p-2 border-b-2 border-divider">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const ccy = m.currency as Currency;
                  return (
                    <tr key={`${m.portfolio_id}-${m.yahoo_symbol}-${m.date}-${m.kind}-${i}`} className="hover:bg-ink/[0.04]">
                      <td className="p-2 border-b border-divider text-[13px]">{m.date}</td>
                      <td className="p-2 border-b border-divider">
                        <Tag variant={KIND_TAG_VARIANT[m.kind]} className="text-[10px]">
                          {MOVEMENT_KIND_LABEL[m.kind]}
                        </Tag>
                      </td>
                      <td className="p-2 border-b border-divider text-[13px]">{m.portfolio_name}</td>
                      <td className="p-2 border-b border-divider">
                        <span className="font-mono font-bold text-[12.5px]">{m.yahoo_symbol}</span>
                        <div className="text-muted text-[11.5px]">{m.asset_name}</div>
                      </td>
                      <td className="p-2 border-b border-divider text-right text-[13px]">{formatNumber(m.quantity)}</td>
                      <td className="p-2 border-b border-divider text-right text-[13px]">{formatCurrency(m.price, ccy)}</td>
                      <td className="p-2 border-b border-divider text-right font-bold text-[13px]">{formatCurrency(m.total, ccy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PageFooter moduleLabel="MOVIMIENTOS" right={<>Cada fila queda en la moneda nativa del activo · no es asesoría financiera</>} />
      </PageContainer>
    </>
  );
}
