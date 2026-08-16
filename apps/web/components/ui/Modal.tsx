"use client";

import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, width = 440 }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "color-mix(in srgb, var(--color-neutral-900) 50%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col gap-3 p-5 bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h3 className="m-0 font-sans font-extrabold text-lg">{title}</h3>
          <button type="button" onClick={onClose} className="ml-auto text-xl leading-none text-ink/60 hover:text-ink cursor-pointer" aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
