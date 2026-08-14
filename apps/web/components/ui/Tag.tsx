type TagVariant = "accent" | "neutral" | "outline";

interface TagProps {
  variant?: TagVariant;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<TagVariant, string> = {
  accent: "bg-accent-100 text-accent-800",
  neutral: "bg-neutral-100 text-neutral-800",
  outline: "border border-accent text-accent",
};

export function Tag({ variant = "neutral", className = "", children }: TagProps) {
  return (
    <span className={`inline-flex items-center text-[11px] tracking-wide px-2.5 py-0.5 ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  );
}
