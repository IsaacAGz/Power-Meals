"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lightning, MapPin } from "@phosphor-icons/react";
import { pickupPoints, zones } from "@/lib/locations-data";

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
          selectedZone={selected}
          onZoneClick={setSelected}
          cooperativeGestures={!desktop}
          className="border border-line"
        />
      </div>

      <div className="flex flex-col gap-12">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Zonas de entrega</h2>
          <ul className="mt-5 flex flex-col gap-2">
            {zones.map((zone) => {
              const active = zone.slug === selected;
              return (
                <li key={zone.slug}>
                  <div
                    className={`rounded-frame border p-5 transition-colors duration-200 ${
                      active ? "border-ink bg-paper" : "border-line bg-cream hover:border-line-strong"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(zone.slug)}
                      aria-pressed={active}
                      className="flex w-full items-start justify-between gap-4 rounded-control text-left"
                    >
                      <span>
                        <span className="block font-display text-xl font-bold tracking-tight">{zone.name}</span>
                        <span className="mt-1 block text-sm text-muted">Entregas: {zone.days}</span>
                      </span>
                      <span
                        aria-hidden
                        className={`mt-1 size-3 shrink-0 rounded-[3px] border border-ink transition-colors ${
                          active ? "bg-power" : "bg-power/25"
                        }`}
                      />
                    </button>
                    <Link
                      href={`/pedido?zona=${zone.slug}`}
                      className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
                    >
                      Pedir en esta zona
                      <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Puntos de recolección</h2>
          <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {pickupPoints.map((point) => (
              <li key={point.slug} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-frame bg-ink text-power">
                  <Lightning weight="bold" className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{point.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                    <MapPin weight="bold" className="size-3.5" aria-hidden />
                    {point.address}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{point.hours}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
