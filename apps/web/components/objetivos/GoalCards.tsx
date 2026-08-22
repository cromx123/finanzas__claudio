import type { GoalCardData } from "../../lib/calc/goals";
import { Input } from "../ui/Input";
import { ProgressBar } from "../ui/ProgressBar";

interface GoalCardProps {
  kicker: string;
  data: GoalCardData;
  editableLabel?: string;
  editableValue?: number;
  onEditableChange?: (value: number) => void;
}

function GoalCard({ kicker, data, editableLabel, editableValue, onEditableChange }: GoalCardProps) {
  return (
    <div className="bg-surface px-[22px] py-5">
      <div className="card-kicker text-[10px] tracking-[0.1em] uppercase text-accent">{kicker}</div>
      <div className="flex items-baseline gap-2.5 my-2 mb-2.5">
        <span className="font-sans font-extrabold text-[36px] tracking-[-0.01em]">{data.pctLabel}</span>
        <span className="text-muted text-xs">{data.subLabel}</span>
      </div>
      <ProgressBar percent={data.widthPct} color="accent" height={12} />
      {editableLabel ? (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-muted text-[11px]">{editableLabel}</span>
          <Input
            type="number"
            defaultValue={editableValue}
            onChange={(e) => onEditableChange?.(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-[90px] min-h-[30px] py-[3px] px-2"
          />
          <span className="text-muted text-[11px] ml-auto">{data.extraLabel}</span>
        </div>
      ) : (
        <div className="text-muted text-[11px] mt-3">{data.extraLabel}</div>
      )}
    </div>
  );
}

export function GoalCards({
  goal1,
  goal2,
  goal3,
  metaDiv,
  onMetaDivChange,
  gasto,
  onGastoChange,
  ccy,
}: {
  goal1: GoalCardData;
  goal2: GoalCardData;
  goal3: GoalCardData;
  metaDiv: number;
  onMetaDivChange: (v: number) => void;
  gasto: number;
  onGastoChange: (v: number) => void;
  ccy: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <GoalCard
        kicker="Objetivo 1 · Dividendo mensual"
        data={goal1}
        editableLabel={`META ${ccy}/MES`}
        editableValue={metaDiv}
        onEditableChange={onMetaDivChange}
      />
      <GoalCard
        kicker="Objetivo 2 · Cobertura del costo de vida"
        data={goal2}
        editableLabel={`GASTO ${ccy}/MES`}
        editableValue={gasto}
        onEditableChange={onGastoChange}
      />
      <GoalCard kicker="Objetivo 3 · Próximo gran hito" data={goal3} />
    </div>
  );
}
