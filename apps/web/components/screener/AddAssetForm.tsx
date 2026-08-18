"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAddScreenerAsset, useAssetSearch } from "../../hooks/useApi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function AddAssetForm({ onAdded }: { onAdded: (yahooSymbol: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [debouncedTicker, setDebouncedTicker] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addAsset = useAddScreenerAsset();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTicker(ticker), 250);
    return () => clearTimeout(t);
  }, [ticker]);

  useEffect(() => () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
  }, []);

  const { data: suggestions } = useAssetSearch(debouncedTicker);
  const showSuggestions = suggestOpen && (suggestions?.length ?? 0) > 0;

  const submit = async (symbolOverride?: string) => {
    const symbol = (symbolOverride ?? ticker).trim().toUpperCase();
    if (!symbol) return setError("Ingresa un ticker.");
    setError(null);
    setSuggestOpen(false);
    try {
      const asset = await addAsset.mutateAsync(symbol);
      onAdded(asset.yahoo_symbol);
      setTicker("");
      setOpen(false);
    } catch {
      setError(`No se pudo agregar "${symbol}" — revisa que sea un ticker real (ej: NVDA, 7203.T, CHILE.SN).`);
    }
  };

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="text-xs"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        <Plus size={14} strokeWidth={2} />
        Agregar ticker
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-start gap-2">
        <div className="relative">
          <Input
            placeholder="Ej: NVDA, 7203.T, CHILE.SN"
            value={ticker}
            autoComplete="off"
            autoFocus
            className="w-[220px]"
            onChange={(e) => {
              setTicker(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => {
              blurTimeout.current = setTimeout(() => setSuggestOpen(false), 120);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          {showSuggestions ? (
            <ul className="absolute z-10 left-0 right-0 mt-0.5 max-h-[220px] overflow-y-auto bg-surface border border-divider shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
              {suggestions!.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(s.symbol)}
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
        <Button variant="primary" className="text-xs" onClick={() => submit()} disabled={addAsset.isPending}>
          {addAsset.isPending ? "Agregando…" : "Agregar"}
        </Button>
        <Button variant="secondary" className="text-xs" onClick={() => setOpen(false)} disabled={addAsset.isPending}>
          Cancelar
        </Button>
      </div>
      {error ? <p className="text-accent-700 text-xs max-w-[420px] text-right">{error}</p> : null}
    </div>
  );
}
