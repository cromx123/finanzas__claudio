"use client";

import Link from "next/link";
import { useAlerts, useGoalsProgress } from "../../hooks/useApi";
import { formatPercent, formatUsd } from "../../lib/format";
import { ProgressBar } from "../ui/ProgressBar";

/**
 * "Salud financiera" at a glance — deliberately cross-portfolio (unlike the
 * rest of Panel, which is scoped to whichever portfolio is active): the FI
 * number and combined dividend income are inherently whole-picture
 * concepts, same USD convention Objetivos already uses for them. Sits at
 * the top of Panel so it's the first thing a user sees, per the "understand
 * your financial health in under 5 seconds" goal.
 */
export function FinancialHealthCard() {
  const { data: progress } = useGoalsProgress("USD");
  const { data: alerts } = useAlerts();

  if (!progress) return null;

  const fiPct = progress.numero_fi > 0 ? Math.min((progress.patrimonio_total / progress.numero_fi) * 100, 100) : 0;
  const dividendoDiario = (progress.dividendo_mensual * 12) / 365;
  const activeAlerts = (alerts ?? []).filter((a) => a.active).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-divider border-2 border-divider mb-10">
      <div className="px-5 py-4">
        <h6 className="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">
          Camino a tu independencia financiera
        </h6>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-sans font-extrabold text-[22px]">{formatPercent(fiPct)}</span>
          <span className="text-muted text-[11.5px]">
            {formatUsd(progress.patrimonio_total)} de {formatUsd(progress.numero_fi)}
          </span>
        </div>
        <ProgressBar percent={fiPct} color="accent" />
      </div>
      <div className="px-5 py-4">
        <h6 className="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">
          Tus inversiones te pagan
        </h6>
        <div className="font-sans font-extrabold text-[22px]">{formatUsd(dividendoDiario, 2)}/día</div>
        <div className="text-muted text-[11.5px] mt-0.5">
          {formatUsd(progress.dividendo_mensual, 2)}/mes · bruto, todos tus portafolios
        </div>
      </div>
      <div className="px-5 py-4">
        <h6 className="m-0 mb-2 text-[11px] uppercase tracking-[0.08em] font-sans font-extrabold text-neutral-600">Alertas activas</h6>
        <div className="flex items-baseline gap-2">
          <span className="font-sans font-extrabold text-[22px]">{activeAlerts}</span>
          <Link href="/perfil" className="text-[11.5px] text-accent hover:underline">
            Ver en Perfil →
          </Link>
        </div>
      </div>
    </div>
  );
}
