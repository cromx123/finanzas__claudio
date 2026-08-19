"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useAddScreenerAsset } from "../../hooks/useApi";
import { TickerAutocomplete } from "../shared/TickerAutocomplete";
import { Button } from "../ui/Button";

export function AddAssetForm({ onAdded }: { onAdded: (yahooSymbol: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addAsset = useAddScreenerAsset();

  const submit = async (symbolOverride?: string) => {
    const symbol = (symbolOverride ?? ticker).trim().toUpperCase();
    if (!symbol) return setError("Ingresa un ticker.");
    setError(null);
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
        <TickerAutocomplete
          placeholder="Ej: NVDA, 7203.T, CHILE.SN"
          value={ticker}
          onChange={setTicker}
          onSelect={submit}
          autoFocus
          className="w-[220px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
        />
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
