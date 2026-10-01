"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lightning, MapPin } from "@phosphor-icons/react";
import { pickupPoints } from "@/lib/locations-data";

const BrandMap = dynamic(() => import("./BrandMap"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0 rounded-frame bg-[#EFEADF]" />,
});

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function LocationsExplorer() {
  const [selected, setSelected] = useState<string | null>(null);
  const desktop = useIsDesktop();

  return (
    <div className="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-10">
      <div className="relative h-[60dvh] min-h-[380px] lg:sticky lg:top-24 lg:order-last lg:h-[calc(100dvh-8rem)]">
        <BrandMap
          selectedPoint={selected}
          onPointClick={setSelected}
          cooperativeGestures={!desktop}
          className="border border-line"
        />
      </div>

      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Puntos de recolección</h2>
        <ul className="mt-5 flex flex-col gap-2">
          {pickupPoints.map((point) => {
            const active = point.slug === selected;
            return (
              <li key={point.slug}>
                <div
                  className={`rounded-frame border p-5 transition-colors duration-200 ${
                    active ? "border-ink bg-paper" : "border-line bg-cream hover:border-line-strong"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(point.slug)}
                    aria-pressed={active}
                    className="flex w-full items-start gap-4 rounded-control text-left"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-frame bg-ink text-power">
                      <Lightning weight="bold" className="size-5" />
                    </span>
                    <span>
                      <span className="block font-display text-xl font-bold tracking-tight">{point.name}</span>
                      <span className="mt-1 flex items-center gap-1 text-sm text-muted">
                        <MapPin weight="bold" className="size-3.5" aria-hidden />
                        {point.address}
                      </span>
                      <span className="mt-1 block text-[13px] text-muted">{point.hours}</span>
                    </span>
                  </button>
                  <Link
                    href={`/pedido?punto=${point.slug}`}
                    className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
                  >
                    Recoger en este punto
                    <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
