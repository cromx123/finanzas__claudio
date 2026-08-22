"use client";

import { CircleHelp, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "../../context/Theme";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const ONBOARDING_SEEN_KEY = "inversiones-3.0:onboarding-seen";

const ONBOARDING_STOPS: { href: string; label: string; body: string }[] = [
  { href: "/panel", label: "Panel", body: "tu cartera: posiciones, precio, y ganancia/pérdida por activo." },
  { href: "/screener", label: "Screener", body: "explorá el universo de activos por yield, P/E, ROE y más." },
  { href: "/objetivos", label: "Objetivos", body: "armá metas propias y seguí tu camino a la independencia financiera." },
  { href: "/perfil", label: "Perfil", body: "patrimonio combinado entre portafolios, y alertas de precio, RSI o Bollinger." },
];

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
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(ONBOARDING_SEEN_KEY)) setShowOnboarding(true);
  }, []);

  const dismissOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    setShowOnboarding(false);
  };

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
      <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
        {right}
        <button
          type="button"
          onClick={() => setShowOnboarding(true)}
          aria-label="Ver introducción a la app"
          title="Ver introducción"
          className="text-ink/50 hover:text-accent cursor-pointer"
        >
          <CircleHelp size={16} strokeWidth={1.8} />
        </button>
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
      {showOnboarding ? (
        <Modal title="Bienvenido a Inversiones 3.0" onClose={dismissOnboarding} width={480}>
          <p className="text-[13px] text-ink/80 leading-relaxed">
            Es un tracker de inversiones con datos reales de mercado (fundamentales, precios y dividendos vía
            yfinance) — no simula nada. Un vistazo rápido a dónde mirar primero:
          </p>
          <ul className="flex flex-col gap-2.5 my-1">
            {ONBOARDING_STOPS.map((stop) => (
              <li key={stop.href} className="text-[13px] leading-snug">
                <Link href={stop.href} onClick={dismissOnboarding} className="font-bold text-accent hover:underline">
                  {stop.label}
                </Link>
                <span className="text-ink/75"> — {stop.body}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted text-[11.5px]">
            Cada módulo tiene su propio botón de ayuda (el ícono "?" arriba a la derecha) con más detalle. Podés
            volver a ver esta introducción con el "?" junto al modo oscuro.
          </p>
          <Button variant="primary" onClick={dismissOnboarding} className="self-start">
            Entendido, empezar
          </Button>
        </Modal>
      ) : null}
    </div>
  );
}
