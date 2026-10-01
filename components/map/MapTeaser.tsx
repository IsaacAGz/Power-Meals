"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { zones } from "@/lib/locations-data";
import { buttonDark, container } from "@/lib/ui";

const BrandMap = dynamic(() => import("./BrandMap"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0 bg-[#EFEADF]" />,
});

export function MapTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWide(window.matchMedia("(min-width: 768px)").matches);
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="teaser-mapa" className="relative">
      <div ref={ref} className="relative h-[560px] w-full bg-[#EFEADF] md:h-[520px]">
        {visible && (
          <BrandMap
            interactive={false}
            showPickupPoints={false}
            padding={
              wide
                ? { top: 60, right: 60, bottom: 60, left: 520 }
                : { top: 30, right: 24, bottom: 300, left: 24 }
            }
            className="rounded-none"
          />
        )}

        <div className={`${container} pointer-events-none relative flex h-full items-end pb-6 md:items-center md:pb-0`}>
          <div className="pointer-events-auto w-full max-w-[400px] rounded-frame border border-line-strong bg-cream p-6 sm:p-8">
            <h2 id="teaser-mapa" className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Entregamos en Tijuana
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              {zones.map((zone) => zone.name).join(", ")}. También puedes recoger en uno de nuestros puntos.
            </p>
            <Link href="/ubicaciones" className={`${buttonDark} mt-6`}>
              Ver zonas
              <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
