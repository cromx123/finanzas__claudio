"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../../context/Theme";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/screener", label: "Screener" },
  { href: "/comparador", label: "Comparador" },
  { href: "/dividendos", label: "Dividendos" },
  { href: "/objetivos", label: "Objetivos" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/perfil", label: "Perfil" },
];

export function NavBar({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggleDark } = useTheme();
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
      <div className="ml-auto flex items-center gap-2.5">
        {right}
        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={dark ? "Modo claro" : "Modo oscuro"}
          className="text-ink/50 hover:text-accent cursor-pointer"
        >
          {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
      </div>
    </div>
  );
}
