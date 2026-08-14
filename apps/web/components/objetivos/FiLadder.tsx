import type { FiStep } from "../../lib/calc/goals";

const CIRCLE_CLASSES: Record<FiStep["status"], string> = {
  done: "bg-ink text-bg border-ink",
  current: "border-accent text-accent",
  pending: "border-neutral-400 text-transparent",
};

const LINE_CLASSES: Record<FiStep["status"], string> = {
  done: "bg-ink",
  current: "bg-neutral-300",
  pending: "bg-neutral-300",
};

function StepCircle({ status }: { status: FiStep["status"] }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11px] font-bold flex-none border-2 ${CIRCLE_CLASSES[status]}`}
    >
      {status === "done" ? "✓" : ""}
    </span>
  );
}

export function FiLadder({ steps, fiStep }: { steps: FiStep[]; fiStep: FiStep }) {
  return (
    <div className="flex items-start overflow-x-auto">
      {steps.map((s) => (
        <div key={s.key} className="flex items-start flex-1 min-w-[110px]">
          <div className="flex flex-col items-center gap-1.5 flex-none w-24">
            <StepCircle status={s.status} />
            <b className="text-xs whitespace-nowrap">{s.valueLabel}</b>
            <span className="text-muted text-[10px] text-center">{s.statusLabel}</span>
          </div>
          <div className={`flex-1 h-0.5 mt-2.5 ${LINE_CLASSES[s.status]}`} />
        </div>
      ))}
      <div className="flex flex-col items-center gap-1.5 flex-none w-24">
        <StepCircle status={fiStep.status} />
        <b className="text-xs whitespace-nowrap">{fiStep.valueLabel}</b>
        <span className="text-muted text-[10px] text-center">Independencia financiera (regla del 4%)</span>
      </div>
    </div>
  );
}
