"use client";

import { useState } from "react";
import { COUNTRIES, COUNTRY_CURRENCY_DEFAULT, COUNTRY_RETENCION_DEFAULT } from "../../lib/mock/countries";
import type { Country, Currency, PortfolioConfig } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";

const CURRENCIES: Currency[] = ["CLP", "USD", "EUR"];

interface PortfolioFormModalProps {
  portfolio?: PortfolioConfig;
  onClose: () => void;
  onSave: (input: { nombre: string; moneda: Currency; pais: Country; retencion: number }) => void;
  onDelete?: () => void;
}

export function PortfolioFormModal({ portfolio, onClose, onSave, onDelete }: PortfolioFormModalProps) {
  const [nombre, setNombre] = useState(portfolio?.nombre ?? "");
  const [pais, setPais] = useState<Country>(portfolio?.pais ?? "Chile");
  const [moneda, setMoneda] = useState<Currency>(portfolio?.moneda ?? COUNTRY_CURRENCY_DEFAULT.Chile);
  const [retencionPct, setRetencionPct] = useState(Math.round((portfolio?.retencion ?? COUNTRY_RETENCION_DEFAULT.Chile) * 100));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const monedaChanged = portfolio ? moneda !== portfolio.moneda : false;

  return (
    <Modal title={portfolio ? `Editar ${portfolio.nombre}` : "Nuevo portafolio"} onClose={onClose}>
      <Input label="Nombre" placeholder="Ej: Dividendos Chile" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Select
        label="País"
        value={pais}
        onChange={(e) => {
          const p = e.target.value as Country;
          setPais(p);
          setMoneda(COUNTRY_CURRENCY_DEFAULT[p]);
          setRetencionPct(Math.round(COUNTRY_RETENCION_DEFAULT[p] * 100));
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input
        label="Retención de dividendos (%)"
        type="number"
        value={retencionPct}
        onChange={(e) => setRetencionPct(parseFloat(e.target.value) || 0)}
      />
      {monedaChanged ? (
        <p className="text-accent-700 text-xs">
          Cambiaste la moneda: tus transacciones y precios ya ingresados se convertirán de {portfolio!.moneda} a {moneda} con el tipo de cambio
          actual (editable en Perfil).
        </p>
      ) : null}

      <div className="flex justify-between items-center gap-2 mt-1 pt-3 border-t border-divider">
        {onDelete ? (
          confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-accent-700">¿Eliminar este portafolio y todas sus transacciones?</span>
              <button type="button" className="text-accent-700 font-bold underline cursor-pointer" onClick={onDelete}>
                Sí, eliminar
              </button>
              <button type="button" className="text-ink/60 underline cursor-pointer" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="text-accent-700 text-xs underline cursor-pointer" onClick={() => setConfirmDelete(true)}>
              Eliminar portafolio
            </button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => nombre.trim() && onSave({ nombre: nombre.trim(), moneda, pais, retencion: retencionPct / 100 })}
          >
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
