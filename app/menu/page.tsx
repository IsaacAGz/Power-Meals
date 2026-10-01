import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { MenuBrowser } from "@/components/MenuBrowser";
import { Reveal } from "@/components/Reveal";
import { buttonPrimary, container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Menú y precios",
  description: "Platillos de meal prep altos en proteína, balanceados, ligeros y desayunos. Precios por porción en MXN.",
};

export default function MenuPage() {
  return (
    <>
      <section className="pt-12 pb-24 md:pt-20 md:pb-32">
        <div className={container}>
          <Reveal onMount>
            <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-7xl">
              Menú y precios
            </h1>
          </Reveal>
          <Reveal onMount delay={0.08}>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
              Precios por porción en MXN. Elige tus platillos y confirma tu pedido por WhatsApp.
            </p>
          </Reveal>
          <div className="mt-12">
            <MenuBrowser />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-paper py-20 md:py-24">
        <div className={`${container} flex flex-col items-start justify-between gap-8 md:flex-row md:items-center`}>
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">¿Pedido para toda la semana?</h2>
            <p className="mt-3 max-w-[50ch] text-[16px] leading-relaxed text-muted">
              Combina platillos en un solo pedido. Pagas por transferencia al confirmar.
            </p>
          </div>
          <Link href="/pedido" className={buttonPrimary}>
            Pedir
            <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
