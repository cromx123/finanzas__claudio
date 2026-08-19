"use client";

import { useEffect, useState } from "react";

function formatIntegerPart(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Reformats raw typed text into the es-CL money mask — "." for thousands,
 * "," for decimals — live as the user types. Strips anything that isn't a
 * digit or comma, keeps at most one comma, and caps decimals at 2 digits. */
function maskInput(raw: string): string {
  let cleaned = raw.replace(/[^\d,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma !== -1) {
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
  }
  const [intPart, decPart] = cleaned.split(",");
  const formattedInt = formatIntegerPart(intPart || "");
  return decPart === undefined ? formattedInt : `${formattedInt},${decPart.slice(0, 2)}`;
}

function parseMasked(masked: string): number | null {
  if (!masked) return null;
  const value = parseFloat(masked.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(value) ? null : value;
}

function toMasked(value: number): string {
  return maskInput(String(value).replace(".", ","));
}

interface MoneyInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  label?: string;
  placeholder?: string;
  className?: string;
  id?: string;
}

/** Numeric input with the es-CL money mask: thousands separated by ".",
 * decimals by ",", "0,00" placeholder — only digits and a single comma can
 * ever land in the field, formatted as the user types. */
export function MoneyInput({ value, onChange, label, placeholder = "0,00", className = "", id }: MoneyInputProps) {
  const [text, setText] = useState(value === "" ? "" : toMasked(value));

  // Stay in sync when the parent resets the value externally (e.g. clearing
  // the form after submit) without fighting the user's own typing otherwise.
  useEffect(() => {
    if (value === "") setText("");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskInput(e.target.value);
    setText(masked);
    const parsed = parseMasked(masked);
    onChange(parsed === null ? "" : parsed);
  };

  const input = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={handleChange}
      className={`w-full min-h-9 px-2.5 py-1.5 text-sm text-ink bg-surface border border-divider outline-none hover:border-ink/45 focus-visible:border-accent ${className}`}
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
