export interface KpiCell {
  label: string;
  value: string;
  sub: string;
  colorClass?: string;
}

export function KpiGrid({ cells }: { cells: KpiCell[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y divide-divider border-y-2 border-divider">
      {cells.map((c) => (
        <div key={c.label} className="px-5 py-[18px]">
          <h6 className="m-0 mb-1.5 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">{c.label}</h6>
          <div className={`font-sans font-extrabold text-2xl tracking-[-0.01em] ${c.colorClass ?? ""}`}>{c.value}</div>
          <div className="text-muted text-[11px] mt-[3px]">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
