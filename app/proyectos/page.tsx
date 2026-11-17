import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Globe, InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/Reveal";
import { buttonPrimary, container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Proyectos",
  description: "Negocios de Tijuana que trabajan con Power Meals.",
};

type PartnerLink = { kind: "web" | "instagram"; href: string };

/** Partners with their logo (a square image in public/images) and links. */
const brands: { name: string; kind: string; logo: string; links: PartnerLink[] }[] = [
  {
    name: "Casa Toro",
    kind: "Renta de cabañas",
    logo: "/images/casa_toro.jpg",
    links: [
      { kind: "web", href: "https://casa-toro-eight.vercel.app/en/" },
      { kind: "instagram", href: "https://www.instagram.com/casatorovalle/" },
    ],
  },
  {
    name: "Carreta 22",
    kind: "Restaurantes",
    logo: "/images/carreta_22.jpg",
    links: [{ kind: "instagram", href: "https://www.instagram.com/carreta.22/" }],
  },
];

const linkLabel = { web: "Sitio web", instagram: "Instagram" } as const;

export default function ProyectosPage() {
  return (
    <>
      <section className="pt-12 pb-20 md:pt-20 md:pb-24">
        <div className={container}>
          <Reveal onMount>
            <h1 className="max-w-[16ch] font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-7xl">
              Proyectos con partners
            </h1>
          </Reveal>
          <Reveal onMount delay={0.08}>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-muted">
              Negocios de Tijuana que trabajan con Power Meals.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <ul className="mt-16 grid grid-cols-1 overflow-hidden rounded-frame border border-line-strong bg-paper sm:grid-cols-2">
              {brands.map((brand) => (
                <li
                  key={brand.name}
                  className="-mr-px -mb-px flex min-h-40 items-center gap-5 border-r border-b border-line px-6 py-6 md:px-8"
                >
                  <Image
                    src={brand.logo}
                    alt={`Logo de ${brand.name}`}
                    width={96}
                    height={96}
                    className="size-20 shrink-0 md:size-24 rounded-control object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-xl font-extrabold tracking-tight text-ink">{brand.name}</p>
                    <p className="text-[13px] text-muted">{brand.kind}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {brand.links.map((link) => {
                        const Icon = link.kind === "web" ? Globe : InstagramLogo;
                        return (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${brand.name}: ${linkLabel[link.kind]} (se abre en otra pestaña)`}
                            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
                          >
                            <Icon weight="bold" className="size-4" aria-hidden />
                            {linkLabel[link.kind]}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-28">
        <div className={`${container} grid items-end gap-8 md:grid-cols-[1fr_auto]`}>
          <div>
            <h2 className="max-w-[20ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              ¿Tienes un gimnasio, oficina o evento?
            </h2>
            <p className="mt-4 max-w-[50ch] text-[17px] leading-relaxed text-muted">
              Hazte punto de entrega, arma un plan para tu equipo o pide catering para tu evento.
            </p>
          </div>
          <Link href="/contacto" className={buttonPrimary}>
            Solicitar información
            <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
