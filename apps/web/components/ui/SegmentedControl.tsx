"use client";

interface Option<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "accent" | "ink";
  size?: "default" | "compact";
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "ink",
  size = "default",
  className = "",
}: SegmentedControlProps<T>) {
  const padding = size === "compact" ? "px-2.5 py-1.5" : "px-3.5 py-2";
  const activeClasses = variant === "accent" ? "bg-accent text-bg" : "bg-ink text-bg";
  return (
    <div className={`flex border border-divider ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`${padding} font-sans text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
            value === opt.value ? activeClasses : "bg-transparent text-ink hover:bg-ink/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
