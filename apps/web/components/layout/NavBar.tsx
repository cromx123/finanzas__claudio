"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/screener", label: "Screener" },
  { href: "/comparador", label: "Comparador" },
  { href: "/dividendos", label: "Dividendos" },
  { href: "/objetivos", label: "Objetivos" },
];

export function NavBar({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-4 flex-wrap px-4 sm:px-7 py-3.5 border-b-2 border-divider">
      <span className="font-sans font-extrabold text-lg mr-2 whitespace-nowrap">
        INVERSIONES <span className="text-accent">3.0</span>
      </span>
      <nav className="flex items-center gap-4 flex-wrap">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`text-sm ${active ? "text-accent" : "text-ink hover:text-accent"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {right ? <div className="ml-auto flex items-center gap-2.5">{right}</div> : null}
    </div>
  );
}
