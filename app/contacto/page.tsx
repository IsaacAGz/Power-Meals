import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Barbell, Briefcase, Check, ForkKnife, Snowflake } from "@phosphor-icons/react/dist/ssr";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/Reveal";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { isContactKind, type ContactKind } from "@/lib/contact/validation";
import { container } from "@/lib/ui";
import { PARTNER_MESSAGE } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Gimnasios, oficinas y catering",
  description:
    "Haz de tu gimnasio un punto de recogida, arma un plan de comidas para tu oficina o pide catering para tu evento en Tijuana.",
};

const programs: {
  kind: ContactKind;
  icon: typeof Barbell;
  eyebrow: string;
  title: string;
  body: string;
  perks: string[];
  image: string;
  alt: string;
}[] = [
  {
    kind: "gimnasio",
    icon: Barbell,
    eyebrow: "Gimnasios",
    title: "Punto de recogida público",
    body: "Tu gimnasio se vuelve un punto donde cualquier cliente de Power Meals puede recoger su pedido. Más gente pasa por tu recepción y tus socios comen mejor.",
    perks: [
      "Comisión por las ventas recogidas en tu gimnasio",
      "Beneficios exclusivos para tus socios",
      "Tu ubicación en el mapa de Power Meals",
    ],
    image: "/images/contacto-gimnasio.jpg",
    alt: "Refrigerador con contenedores de Power Meals en la recepción de un gimnasio",
  },
  {
    kind: "oficina",
    icon: Briefcase,
    eyebrow: "Oficinas",
    title: "Punto de entrega privado",
    body: "Tu espacio se vuelve un punto de entrega solo para tu equipo, con un plan de suscripción: un mínimo de comidas por semana o un monto pagado por adelantado.",
    perks: [
      "Cada colaborador pide sus platillos dentro del plan",
      "Entrega semanal en tu oficina",
      "Un solo pago para la empresa",
    ],
    image: "/images/contacto-oficina.jpg",
    alt: "Cocina de oficina con un refrigerador de Power Meals y platillos servidos en la barra",
  },
  {
    kind: "catering",
    icon: ForkKnife,
    eyebrow: "Catering",
    title: "Comida para eventos",
    body: "Juntas, capacitaciones y eventos con el mismo menú alto en proteína, porcionado y listo para servir.",
    perks: ["Menú a la medida del evento", "Platillos individuales, sin desorden", "Cotización según invitados"],
    image: "/images/contacto-catering.jpg",
    alt: "Mesa de evento con filas de contenedores de Power Meals y salsas",
  },
];

export default async function ContactoPage({ searchParams }: PageProps<"/contacto">) {
  const { tipo } = await searchParams;
  const initialKind = isContactKind(tipo) ? tipo : "";

  return (
    <>
      <section className="pt-12 pb-20 md:pt-20 md:pb-24">
        <div className={container}>
          <Reveal onMount>
            <h1 className="max-w-[18ch] font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-7xl">
              Lleva Power Meals a tu gimnasio, oficina o evento
            </h1>
          </Reveal>
          <Reveal onMount delay={0.08}>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">
              Hazte partner y convierte tu espacio en un punto de entrega, o pide catering. Cuéntanos qué necesitas y
              te contactamos.
            </p>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="partner" className="border-t border-line bg-paper py-24 md:py-32">
        <div className={container}>
          <Reveal>
            <h2 id="partner" className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              Hazte partner
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {programs.map((program, index) => (
              <Reveal key={program.kind} delay={index * 0.06}>
                <article className="flex h-full flex-col overflow-hidden rounded-frame border border-line-strong bg-cream">
                  <div className="relative aspect-[4/3] bg-placeholder">
                    <Image
                      src={program.image}
                      alt={program.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-muted">
                      <program.icon weight="bold" className="size-5 text-ink" aria-hidden />
                      {program.eyebrow}
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tight">{program.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted">{program.body}</p>
                    <ul className="mt-5 flex flex-col gap-2 text-[15px]">
                      {program.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <Check weight="bold" className="mt-1 size-4 shrink-0 text-power" aria-hidden />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/contacto?tipo=${program.kind}#solicitud`}
                      scroll={false}
                      className="mt-auto inline-flex w-fit items-center gap-1.5 pt-7 font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
                    >
                      Solicitar {program.eyebrow.toLowerCase()}
                      <ArrowRight weight="bold" className="size-4" aria-hidden />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-6 flex items-start gap-4 rounded-frame bg-night p-7 text-day">
              <Snowflake weight="bold" className="mt-0.5 size-7 shrink-0 text-power" aria-hidden />
              <div>
                <p className="font-display text-xl font-extrabold tracking-tight">Refrigerador incluido si lo necesitas</p>
                <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-day/75">
                  Si tu gimnasio u oficina no tiene dónde guardar los platillos, te instalamos un refrigerador.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="solicitud" aria-labelledby="solicitud-titulo" className="scroll-mt-20 border-t border-line py-24 md:py-32">
        <div className={`${container} grid gap-14 lg:grid-cols-[5fr_7fr] lg:gap-20`}>
          <div>
            <h2 id="solicitud-titulo" className="max-w-[16ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              Solicita información
            </h2>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-muted">
              Te respondemos por correo o WhatsApp en 1 a 2 días hábiles con una propuesta para tu espacio o evento.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <p className="text-[15px] text-muted">¿Prefieres WhatsApp?</p>
              <WhatsAppButton message={PARTNER_MESSAGE} />
            </div>
          </div>
          <ContactForm key={initialKind} initialKind={initialKind} />
        </div>
      </section>
    </>
  );
}
