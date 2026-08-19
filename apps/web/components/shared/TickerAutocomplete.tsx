"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAssetSearch, useScreener } from "../../hooks/useApi";
import { Input } from "../ui/Input";

const MAX_SUGGESTIONS = 10;

/** True only when the ticker or the name *starts with* the query — a
 * substring match would surface false positives like "ENELCHILE.SN" for
 * the query "CH" (it contains "ch" but isn't a Chile-adjacent suggestion).
 * Both sides are uppercased, so this is case-insensitive by construction —
 * "aapl", "AAPL", "AaPl" all match the same way. */
function matchesPrefix(symbol: string, name: string, query: string): boolean {
  return symbol.toUpperCase().startsWith(query) || name.toUpperCase().startsWith(query);
}

interface TickerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (symbol: string) => void;
  onDebouncedChange?: (debounced: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Ticker input with live, debounced, case-insensitive suggestions — merges
 * tickers already known to the Screener with a live Yahoo search, deduped.
 * Shared by AddTransactionModal, AddAssetForm, and AlertsPanel so the
 * debounce/dropdown logic exists in exactly one place.
 */
export function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  onDebouncedChange,
  onKeyDown,
  placeholder,
  label,
  autoFocus,
  className = "",
  inputClassName,
}: TickerAutocompleteProps) {
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(value);
      onDebouncedChange?.(value);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(
    () => () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    },
    []
  );

  const { data: screener } = useScreener();
  const { data: yahooResults } = useAssetSearch(debounced);

  const suggestions = useMemo(() => {
    const q = value.trim().toUpperCase();
    if (!q) return [];
    const fromScreener = (screener ?? [])
      .filter((a) => matchesPrefix(a.yahoo_symbol, a.name, q))
      .map((a) => ({ symbol: a.yahoo_symbol, name: a.name }));
    const seen = new Set(fromScreener.map((s) => s.symbol));
    const fromYahoo = (yahooResults ?? []).filter((r) => matchesPrefix(r.symbol, r.name, q) && !seen.has(r.symbol));
    return [...fromScreener, ...fromYahoo].slice(0, MAX_SUGGESTIONS);
  }, [screener, yahooResults, value]);

  const showSuggestions = open && suggestions.length > 0;

  const pick = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
    onSelect?.(symbol);
  };

  return (
    <div className={`relative ${className}`}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        autoFocus={autoFocus}
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
      />
      {showSuggestions ? (
        <ul className="absolute z-10 left-0 right-0 mt-0.5 max-h-[260px] overflow-y-auto bg-surface border border-divider shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
          {suggestions.map((s) => (
            <li key={s.symbol}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s.symbol)}
                className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-ink/[0.06] cursor-pointer"
              >
                <div className="truncate">{s.name}</div>
                <div className="font-mono font-bold text-[11px] text-muted">{s.symbol}</div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
