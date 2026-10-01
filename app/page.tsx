import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bank, ForkKnife, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/Reveal";
import { MapTeaser } from "@/components/map/MapTeaser";
import { dishes, formatMXN } from "@/lib/menu-data";
import { buttonPrimary, buttonSecondary, container, textLink } from "@/lib/ui";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <MenuRow />
      <MapTeaser />
      <ClosingBand />
    </>
  );
}

function Hero() {
  return (
    <section className="relative -mt-16 overflow-hidden bg-cream lg:min-h-[100dvh]">
      <div className={`${container} grid lg:min-h-[100dvh] lg:grid-cols-[7fr_5fr]`}>
        <div className="flex flex-col justify-center pt-28 pb-12 lg:pt-24 lg:pr-12 lg:pb-16">
          <Reveal onMount>
            <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Image src="/logo.svg" alt="" width={22} height={22} className="size-[22px]" />
              Power Meals, Tijuana
            </p>
          </Reveal>
          <Reveal onMount delay={0.08}>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[clamp(3rem,4.4vw,4.6rem)]">
              Comida real. Energía real.{" "}
              <span className="underline decoration-power decoration-[0.14em] underline-offset-[0.12em]">
                Resultados reales.
              </span>
            </h1>
          </Reveal>
          <Reveal onMount delay={0.16}>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted">
              Platillos altos en proteína, cocinados cada semana en Tijuana. Pide por WhatsApp y recibe en tu zona.
            </p>
          </Reveal>
          <Reveal onMount delay={0.24}>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/menu" className={buttonPrimary}>
                Ver menú
                <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/pedido" className={buttonSecondary}>
                Pedir
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="relative -mx-4 aspect-[4/5] sm:-mx-6 sm:aspect-[16/11] lg:static lg:mx-0 lg:aspect-auto">
          <div className="absolute inset-0 lg:top-0 lg:right-0 lg:bottom-0 lg:left-[58.33%]">
            <Image
              src="/images/hero.jpg"
              alt="Bowl con pechuga de pollo a la parrilla, arroz integral, brócoli, aguacate y pico de gallo"
              fill
              preload
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover object-[50%_60%]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-t border-line bg-cream py-24 md:py-32">
      <div className={container}>
        <Reveal>
          <h2 className="max-w-[18ch] font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Así funciona tu pedido
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3 md:grid-rows-2">
          <Reveal className="md:col-span-2 md:row-span-2">
            <article className="relative flex h-full min-h-[440px] flex-col justify-end overflow-hidden rounded-frame bg-[#EFEADF] p-8 md:p-10">
              <Image
                src="/images/platillo-res-chimichurri.jpg"
                alt=""
                fill
                sizes="(min-width: 768px) 66vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/80 via-[#111111]/25 to-transparent" />
              <div className="relative max-w-[40ch] text-cream">
                <ForkKnife weight="bold" className="size-7 text-power" aria-hidden />
                <h3 className="mt-4 font-display text-4xl font-extrabold tracking-tight">Elige</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-cream/85">
                  Arma tu semana con platillos altos en proteína, balanceados o ligeros.
                </p>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.08}>
            <article className="flex h-full flex-col justify-between gap-10 rounded-frame border border-line-strong bg-paper p-8">
              <WhatsappLogo weight="bold" className="size-7 text-ink" aria-hidden />
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight">Confirma por WhatsApp</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  Tu pedido llega armado a nuestro chat. Confirmamos día y hora de entrega.
                </p>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.16}>
            <article className="flex h-full flex-col justify-between gap-10 rounded-frame bg-ink p-8 text-cream">
              <Bank weight="bold" className="size-7 text-power" aria-hidden />
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight">Paga por transferencia</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-cream/75">
                  Al confirmar, te enviamos los datos bancarios por WhatsApp. Sin pagos con tarjeta en línea.
                </p>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MenuRow() {
  return (
    <section className="bg-paper py-24 md:py-32">
      <div className={`${container} flex flex-wrap items-end justify-between gap-6`}>
        <Reveal>
          <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Esta semana en el menú</h2>
        </Reveal>
        <Link href="/menu" className={`${textLink} inline-flex items-center gap-1.5 text-[15px]`}>
          Ver menú
          <ArrowRight weight="bold" className="size-4" />
        </Link>
      </div>

      <Reveal delay={0.1}>
        <ul className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4 sm:scroll-px-6 sm:px-6 lg:scroll-px-10 lg:px-10 min-[1400px]:px-[calc((100vw-1400px)/2+2.5rem)]">
          {dishes.map((dish) => (
            <li key={dish.slug} className="group w-[78vw] max-w-[340px] shrink-0 snap-start">
              <Link href={`/pedido?platillo=${dish.slug}`} className="block rounded-frame">
                <div className="relative aspect-[4/5] overflow-hidden rounded-frame bg-[#EFEADF]">
                  <Image
                    src={dish.image}
                    alt={dish.name}
                    fill
                    sizes="340px"
                    className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <h3 className="text-[16px] font-semibold leading-snug">{dish.name}</h3>
                  <span className="shrink-0 font-mono text-[15px] tabular-nums text-muted">{formatMXN(dish.price)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

function ClosingBand() {
  return (
    <section className="border-t border-line bg-cream py-24 md:py-36">
      <div className={`${container} flex flex-col items-center text-center`}>
        <Reveal>
          <h2 className="max-w-[16ch] font-display text-5xl leading-[1.02] font-extrabold tracking-[-0.03em] md:text-7xl">
            Arma tu pedido de la semana
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-muted">
            Confirmamos por WhatsApp y pagas por transferencia bancaria.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <Link href="/pedido" className={`${buttonPrimary} mt-10 h-14 px-8 text-base`}>
            Pedir
            <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
