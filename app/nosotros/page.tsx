import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Barbell, InstagramLogo, Leaf, Snowflake, Truck } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/Reveal";
import { buttonPrimary, container } from "@/lib/ui";

const CARRETA_INSTAGRAM = "https://www.instagram.com/carreta.22/";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "Power Meals es una cocina de meal prep en Tijuana: platillos altos en proteína, listos para tu semana.",
};

const values = [
  {
    icon: Leaf,
    title: "Ingredientes frescos",
    body: "Compramos cada semana con proveedores y mercados locales de Baja California.",
  },
  {
    icon: Barbell,
    title: "Proteína en cada platillo",
    body: "Cada comida se arma alrededor de una buena porción de proteína, con carbohidratos y verduras de verdad.",
  },
  {
    icon: Snowflake,
    title: "Listo para tu semana",
    body: "Empacamos en contenedores que van del refri al microondas. Calientas y comes.",
  },
  {
    icon: Truck,
    title: "Cerca de ti",
    body: "Entregamos en cinco zonas de Tijuana, o recoges en uno de nuestros puntos.",
  },
];

export default function NosotrosPage() {
  return (
    <>
      <section className="pt-12 pb-24 md:pt-20 md:pb-32">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16`}>
          <div>
            <Reveal onMount>
              <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">
                Meal prep hecho en Tijuana, para Tijuana
              </h1>
            </Reveal>
            <Reveal onMount delay={0.08}>
              <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-muted">
                Power Meals nació de una idea simple: comer bien no debería costarte tu domingo. Cocinamos por ti para
                que tu semana tenga comida real lista en el refri.
              </p>
              <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
                Recetas mexicanas y de siempre, con porciones pensadas para entrenar, trabajar y rendir.
              </p>
            </Reveal>
          </div>
          <Reveal onMount delay={0.12}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-frame bg-placeholder">
              <Image
                src="/images/nosotros-cocina.jpg"
                alt="Cocinero sirviendo pollo a la parrilla en contenedores de meal prep"
                fill
                preload
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="carreta" className="bg-night py-24 text-day md:py-32">
        <div className={container}>
          <Reveal>
            <Image
              src="/brand/power-meals-x-carreta.png"
              alt="Power Meals × Carreta Veintidós, cocina creativa"
              width={1100}
              height={286}
              sizes="(min-width: 768px) 520px, 90vw"
              className="h-auto w-full max-w-[520px]"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="carreta" className="mt-12 max-w-[20ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
              Power Meals × Carreta Veintidós
            </h2>
            <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-day/70">
              La marca y la cocina detrás de cada platillo.
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-frame bg-placeholder">
              <Image
                src="/images/nosotros-carreta-cocina.jpg"
                alt="Chef de Carreta Veintidós terminando contenedores de Power Meals en la cocina"
                fill
                sizes="(min-width: 1400px) 1320px, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div className="mt-14 grid gap-10 border-t border-day/15 pt-10 md:grid-cols-2 md:gap-16">
            <Reveal>
              <h3 className="font-display text-2xl font-extrabold tracking-tight text-power">Power Meals</h3>
              <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-day/75">
                Diseñamos el menú, las porciones y el servicio: proteína medida, carbohidrato y verdura, listo para tu
                semana.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h3 className="font-display text-2xl font-extrabold tracking-tight text-power">
                Carreta Veintidós, cocina creativa
              </h3>
              <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-day/75">
                El equipo de cocina que prepara cada platillo. Su oficio de restaurante, aplicado al meal prep: sazón
                de verdad, cocinado cada semana en Tijuana.
              </p>
              <a
                href={CARRETA_INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Carreta Veintidós en Instagram (se abre en otra pestaña)"
                className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-day underline decoration-power decoration-2 underline-offset-4 transition-colors hover:decoration-day"
              >
                <InstagramLogo weight="bold" className="size-4" aria-hidden />
                @carreta.22
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-paper py-24 md:py-32">
        <div className={`${container} grid gap-14 md:grid-cols-2 md:gap-16`}>
          <div className="md:sticky md:top-24 md:self-start">
            <Reveal>
              <h2 className="max-w-[14ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
                Lo que cuidamos en cada comida
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="relative mt-10 aspect-[4/5] max-w-[440px] overflow-hidden rounded-frame bg-placeholder">
                <Image
                  src="/images/nosotros-ingredientes.jpg"
                  alt="Ingredientes frescos: pechuga de pollo, sirloin, salmón, camote, brócoli, zanahoria, calabacita, tomatillo, chiles y arroz"
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          </div>

          <ul className="flex flex-col md:pt-2">
            {values.map((value, index) => (
              <li key={value.title} className={index === 0 ? "pb-10" : "border-t border-line py-10"}>
                <Reveal delay={index * 0.05}>
                  <value.icon weight="bold" className="size-7 text-ink" aria-hidden />
                  <h3 className="mt-5 font-display text-3xl font-bold tracking-tight">{value.title}</h3>
                  <p className="mt-3 max-w-[46ch] text-[17px] leading-relaxed text-muted">{value.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line py-20 md:py-28">
        <div className={`${container} flex flex-col items-start justify-between gap-8 md:flex-row md:items-center`}>
          <h2 className="max-w-[22ch] font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Conoce los platillos de esta semana
          </h2>
          <Link href="/menu" className={buttonPrimary}>
            Ver menú
            <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
