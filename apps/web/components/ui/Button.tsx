import Link from "next/link";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-bg hover:bg-accent-600 active:bg-accent-700",
  secondary: "border border-divider hover:bg-ink/[0.07] active:bg-ink/[0.14]",
};

const BASE = "inline-flex items-center justify-center gap-1.5 font-sans font-extrabold text-sm px-3.5 py-2 cursor-pointer";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </Link>
  );
}
