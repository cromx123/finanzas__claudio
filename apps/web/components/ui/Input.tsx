import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  const input = (
    <input
      id={id}
      className={`w-full min-h-9 px-2.5 py-1.5 text-sm text-ink bg-surface border border-divider outline-none hover:border-ink/45 focus-visible:border-accent ${className}`}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <div className="field">
      <label htmlFor={id} className="block text-xs mb-1 text-ink/70">
        {label}
      </label>
      {input}
    </div>
  );
}

export function Select({
  label,
  id,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const select = (
    <select
      id={id}
      className={`w-full min-h-9 px-2.5 py-1.5 text-sm text-ink bg-surface border border-divider outline-none hover:border-ink/45 focus-visible:border-accent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <div className="field">
      <label htmlFor={id} className="block text-xs mb-1 text-ink/70">
        {label}
      </label>
      {select}
    </div>
  );
}
