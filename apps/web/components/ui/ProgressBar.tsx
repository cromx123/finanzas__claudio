export interface ProgressBarSegment {
  value: number;
  color: string;
}

interface ProgressBarProps {
  percent?: number;
  segments?: ProgressBarSegment[];
  color?: "ink" | "accent";
  height?: number;
  className?: string;
}

export function ProgressBar({ percent, segments, color = "ink", height = 10, className = "" }: ProgressBarProps) {
  if (segments && segments.length > 0) {
    return (
      <div className={`flex gap-[2px] overflow-hidden bg-neutral-200 ${className}`} style={{ height }}>
        {segments.map((s, i) => (
          <div key={i} style={{ height, width: `${Math.min(100, Math.max(0, s.value))}%`, background: s.color }} />
        ))}
      </div>
    );
  }
  const clamped = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <div className={`bg-neutral-200 ${className}`} style={{ height }}>
      <div className={color === "accent" ? "bg-accent" : "bg-ink"} style={{ height, width: `${clamped}%` }} />
    </div>
  );
}
