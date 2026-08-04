import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppLocale } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Transition LATAM — Inteligencia de la Transición Energética",
    template: "%s · Transition LATAM",
  },
  description:
    "Plataforma de inteligencia de mercado para la transición energética en Chile: proyectos, tecnologías, capacidad y pipeline en un solo lugar.",
};

// Evita el pinch-zoom accidental en móvil (molesto al navegar tablas/mapas) —
// a cambio, el usuario pierde la posibilidad de agrandar contenido con los
// dedos, así que si algún texto queda chico en móvil hay que corregirlo en el
// diseño, no depender del zoom del navegador como respaldo.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getAppLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
