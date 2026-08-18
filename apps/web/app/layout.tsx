import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "Inversiones 3.0",
  description: "Plataforma de gestión de inversiones y seguimiento de cartera",
};

// Applies the persisted dark-mode class before hydration so there's no
// flash of the light theme — must run synchronously, hence a plain inline
// script rather than a useEffect (see context/Theme.tsx).
const THEME_INIT_SCRIPT = `try{if(JSON.parse(localStorage.getItem("inversiones-3.0:dark-mode")||"false"))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
