"use client";

import { useQuery } from "@tanstack/react-query";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { useMemo, useRef, useState } from "react";
import { formatCurrency, formatPercent } from "../../lib/format";
import { accentRampColor } from "../../lib/geo/colorScale";
import { ALPHA2_TO_NAME_ES, ALPHA3_TO_ALPHA2 } from "../../lib/geo/countries";
import type { Currency } from "../../lib/types";
import { ProgressBar } from "../ui/ProgressBar";

const WIDTH = 960;
const HEIGHT = 460;

function useWorldGeo() {
  return useQuery({
    queryKey: ["world-geo"],
    queryFn: () => fetch("/geo/world-countries.geo.json").then((r) => r.json() as Promise<FeatureCollection>),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

interface CountryRow {
  country: string;
  value: number;
}

interface HoverState {
  a2: string;
  value: number;
  x: number;
  y: number;
}

export function WorldMap({ rows, currency }: { rows: CountryRow[]; currency: Currency }) {
  const { data: geo } = useWorldGeo();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);

  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const maxValue = rows.reduce((max, r) => Math.max(max, r.value), 0);
  const valueByAlpha2 = useMemo(() => new Map(rows.map((r) => [r.country, r.value])), [rows]);

  const { features, path } = useMemo(() => {
    if (!geo) return { features: [] as Feature[], path: null };
    const projection = geoEqualEarth().fitSize([WIDTH, HEIGHT], geo);
    return { features: geo.features, path: geoPath(projection) };
  }, [geo]);

  function handleHover(e: React.MouseEvent, a2: string | undefined, value: number) {
    if (!a2 || value <= 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHovered({ a2, value, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  if (rows.length === 0) {
    return <p className="text-muted text-sm py-6">Todavía no tienes holdings — agrega transacciones desde el Panel.</p>;
  }

  return (
    <div>
      <div ref={containerRef} className="relative border border-divider bg-neutral-100">
        {!geo || !path ? (
          <div className="h-[280px] flex items-center justify-center text-muted text-xs">Cargando mapa…</div>
        ) : (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto block" role="img" aria-label="Mapa mundial con la distribución geográfica del patrimonio">
            {features.map((f) => {
              const a3 = (f.properties as { A3: string }).A3;
              const a2 = ALPHA3_TO_ALPHA2[a3];
              const value = a2 ? (valueByAlpha2.get(a2) ?? 0) : 0;
              const d = path(f);
              if (!d) return null;
              const isHovered = hovered?.a2 === a2 && value > 0;
              return (
                <path
                  key={a3}
                  d={d}
                  fill={value > 0 ? accentRampColor(maxValue > 0 ? value / maxValue : 0) : "var(--color-neutral-200)"}
                  stroke={isHovered ? "var(--color-ink)" : "var(--color-neutral-400)"}
                  strokeWidth={isHovered ? 1.4 : 0.4}
                  onMouseEnter={(e) => handleHover(e, a2, value)}
                  onMouseMove={(e) => handleHover(e, a2, value)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </svg>
        )}
        {hovered ? (
          <div
            className="absolute z-10 pointer-events-none bg-ink text-bg text-[11px] leading-tight px-2.5 py-1.5 -translate-x-1/2 -translate-y-full"
            style={{ left: hovered.x, top: hovered.y - 10 }}
          >
            <b>{ALPHA2_TO_NAME_ES[hovered.a2] ?? hovered.a2}</b>
            <div className="text-bg/80">
              {formatCurrency(hovered.value, currency)} · {formatPercent(total > 0 ? (hovered.value / total) * 100 : 0)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {[...rows]
          .sort((a, b) => b.value - a.value)
          .map((r) => (
            <div key={r.country} className="py-2.5 border-t border-divider">
              <div className="flex text-[12.5px] mb-1.5">
                <b>{ALPHA2_TO_NAME_ES[r.country] ?? r.country}</b>
                <span className="ml-auto">
                  <span className="text-muted">{formatCurrency(r.value, currency)}</span> ·{" "}
                  {formatPercent(total > 0 ? (r.value / total) * 100 : 0)}
                </span>
              </div>
              <ProgressBar percent={total > 0 ? (r.value / total) * 100 : 0} />
            </div>
          ))}
      </div>
    </div>
  );
}
