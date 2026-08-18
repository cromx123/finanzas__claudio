"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="Página anterior"
        className="text-ink/60 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>
      <span className="text-xs text-muted">
        Página {page + 1} de {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        aria-label="Página siguiente"
        className="text-ink/60 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
