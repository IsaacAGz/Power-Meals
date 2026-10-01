import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cabinet = localFont({
  variable: "--font-cabinet",
  display: "swap",
  src: [
    { path: "./fonts/CabinetGrotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/CabinetGrotesk-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/CabinetGrotesk-800.woff2", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Power Meals | Comida real. Energía real. Resultados reales.",
    template: "%s | Power Meals",
  },
  description:
    "Meal prep alto en proteína en Tijuana. Elige tus platillos, confirma tu pedido por WhatsApp y paga por transferencia.",
  openGraph: {
    locale: "es_MX",
    siteName: "Power Meals",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F1E8",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} ${geistMono.variable} ${cabinet.variable} antialiased`}>
      <body className="flex min-h-[100dvh] flex-col bg-cream text-ink">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-control focus:bg-power focus:px-4 focus:py-2 focus:font-semibold"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
