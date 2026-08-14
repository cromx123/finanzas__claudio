interface ProgressBarProps {
  percent: number;
  color?: "ink" | "accent";
  height?: number;
  className?: string;
}

export function ProgressBar({ percent, color = "ink", height = 10, className = "" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={`bg-neutral-200 ${className}`} style={{ height }}>
      <div className={color === "accent" ? "bg-accent" : "bg-ink"} style={{ height, width: `${clamped}%` }} />
    </div>
  );
}
