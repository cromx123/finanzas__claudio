"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HelpButtonProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function HelpButton({ title, children, className = "" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Ayuda — ${title}`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-6 h-6 border border-divider text-ink/60 bg-surface hover:text-accent hover:border-accent cursor-pointer flex-none"
      >
        <CircleHelp size={14} strokeWidth={1.8} />
      </button>
      {open ? (
        <div className="absolute z-30 right-0 top-full mt-2 w-[300px] bg-surface border border-divider p-3.5 text-left">
          <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5 text-accent">{title}</div>
          <div className="text-[12.5px] text-ink/85 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_b]:font-bold [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
