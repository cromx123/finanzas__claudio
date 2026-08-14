"use client";

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "accent" | "ink";
  className?: string;
}

export function ToggleButton({ active, onClick, children, variant = "accent", className = "" }: ToggleButtonProps) {
  const activeClasses = variant === "accent" ? "bg-accent text-bg border-accent" : "bg-ink text-bg border-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 font-sans text-[11px] font-bold uppercase tracking-wide cursor-pointer border transition-colors ${
        active ? activeClasses : "bg-transparent text-ink border-divider hover:bg-ink/5"
      } ${className}`}
    >
      {children}
    </button>
  );
}
