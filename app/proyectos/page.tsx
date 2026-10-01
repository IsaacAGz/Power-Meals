import type { Metadata } from "next";
import Image from "next/image";
import { PartnerMark, type PartnerShape } from "@/components/PartnerMark";
import { Reveal } from "@/components/Reveal";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { container } from "@/lib/ui";
import { PARTNER_MESSAGE } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Proyectos",
  description: "Gimnasios, estudios y oficinas de Tijuana que trabajan con Power Meals.",
};

// Placeholder partners and case studies: replace with real partners before launch.
const partners: { name: string; shape: PartnerShape }[] = [
  { name: "Hierro Gym", shape: "square" },
  { name: "Estudio Cardón", shape: "arch" },
  { name: "Río Cowork", shape: "split" },
  { name: "Baja Box", shape: "diamond" },
  { name: "Pacífico Run Club", shape: "ring" },
  { name: "Clínica Nutre", shape: "circle" },
];

const cases = [
  {
    partner: "Hierro Gym",
    title: "Platillos listos en la recepción del gimnasio",
    body: "Un refrigerador con el menú de la semana junto a la entrada. Los socios toman su comida al salir de entrenar y la pagan con el gimnasio.",
    image: "/images/proyecto-gimnasio.jpg",
    alt: "Refrigerador con contenedores de Power Meals junto a un rack de pesas rusas",
  },
  {
    partner: "Río Cowork",
    title: "Comida de equipo sin salir de la oficina",
    body: "Pedidos semanales para el equipo con entrega los lunes y miércoles. Cada persona elige su platillo desde un solo chat.",
    image: "/images/proyecto-oficina.jpg",
    alt: "Mesa de oficina con varios contenedores de Power Meals abiertos a la hora de la comida",
  },
];

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
              Trabajamos con gimnasios, estudios y oficinas de Tijuana para que su gente coma mejor durante la semana.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <ul className="mt-16 grid grid-cols-1 overflow-hidden rounded-frame border border-line-strong bg-paper sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((partner) => (
                <li
                  key={partner.name}
                  className="-mr-px -mb-px flex h-32 items-center justify-center border-r border-b border-line px-6"
                >
                  <PartnerMark name={partner.name} shape={partner.shape} />
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line bg-paper py-24 md:py-32">
        <div className={`${container} flex flex-col gap-24 md:gap-32`}>
          {cases.map((item, index) => (
            <article
              key={item.title}
              className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
            >
              <Reveal className={index % 2 === 1 ? "md:order-last" : ""}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-frame bg-[#EFEADF]">
                  <Image src={item.image} alt={item.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="text-[15px] font-semibold text-muted">{item.partner}</p>
                <h2 className="mt-3 max-w-[20ch] font-display text-4xl font-extrabold tracking-tight">{item.title}</h2>
                <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-muted">{item.body}</p>
              </Reveal>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-28">
        <div className={`${container} grid items-end gap-8 md:grid-cols-[1fr_auto]`}>
          <div>
            <h2 className="max-w-[20ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              ¿Tienes un gimnasio, estudio u oficina?
            </h2>
            <p className="mt-4 max-w-[50ch] text-[17px] leading-relaxed text-muted">
              Armamos un programa de comidas a la medida de tu equipo o tus socios.
            </p>
          </div>
          <WhatsAppButton message={PARTNER_MESSAGE} variant="primary" />
        </div>
      </section>
    </>
  );
}
