import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { MenuBrowser } from "@/components/MenuBrowser";
import { PackageCards } from "@/components/PackageCards";
import { Reveal } from "@/components/Reveal";
import { getCatalog } from "@/lib/catalog";
import { menuCards } from "@/lib/catalog/menu";
import { isOpenpayConfigured } from "@/lib/openpay";
import { buttonPrimary, container } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const card = isOpenpayConfigured();
  return {
    title: "Menú y precios",
    description: card
      ? "Platillos de meal prep en Regular y Plus, paquetes POWER Chicken y POWER Mix. Arma tu platillo y paga en línea. Precios en MXN."
      : "Platillos de meal prep en Regular y Plus, paquetes POWER Chicken y POWER Mix. Arma tu platillo y pide por WhatsApp. Precios en MXN.",
  };
}

export default async function MenuPage() {
  await connection();
  const catalog = await getCatalog();

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
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">
              Cada platillo viene en Regular o Plus, balanceado con vegetales o con doble carb. Precios por porción en MXN,
              con 1 oz de salsa roja o verde incluida.
            </p>
          </Reveal>
          <div className="mt-12">
            <MenuBrowser items={menuCards(catalog)} filters={catalog.filters} />
          </div>
        </div>
      </section>

      {catalog.packages.length > 0 && (
        <section id="paquetes" className="border-t border-line bg-cream py-20 md:py-24">
          <div className={container}>
            <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Paquetes para la semana</h2>
            <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
              6, 10 o 15 comidas a mejor precio. Eliges la base y el estilo de cada una.
            </p>
            <div className="mt-10">
              <PackageCards packages={catalog.packages} />
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-line bg-paper py-20 md:py-24">
        <div className={`${container} flex flex-col items-start justify-between gap-8 md:flex-row md:items-center`}>
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">Arma tu propio platillo</h2>
            <p className="mt-3 max-w-[50ch] text-[16px] leading-relaxed text-muted">
              {isOpenpayConfigured()
                ? "Elige proteína, base, tamaño y estilo. Pagas con tarjeta en Openpay o por WhatsApp."
                : "Elige proteína, base, tamaño y estilo. Envía tu pedido por WhatsApp y paga por transferencia."}
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
