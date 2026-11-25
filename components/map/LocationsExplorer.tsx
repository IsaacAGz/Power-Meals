"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Clock, Lightning, MapPin } from "@phosphor-icons/react";
import { mapPins } from "@/lib/locations-data";

const BrandMap = dynamic(() => import("./BrandMap"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute inset-0 rounded-frame bg-placeholder" />,
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
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Cocinas</h2>
        <ul className="mt-5 flex flex-col gap-2">
          {mapPins.map((point) => {
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
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-frame bg-night text-power">
                      <Lightning weight="bold" className="size-5" />
                    </span>
                    <span>
                      <span className="block font-display text-xl font-bold tracking-tight">{point.name}</span>
                      {point.address ? (
                        <span className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                          <MapPin weight="bold" className="mt-[3px] size-3.5 shrink-0" aria-hidden />
                          {point.address}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {point.hoursRows.length ? (
                    <div className="mt-4 flex items-start gap-1.5 pl-14 text-[13px]">
                      <Clock weight="bold" className="mt-[2px] size-3.5 shrink-0 text-muted" aria-hidden />
                      <dl aria-label={`Horario de ${point.name}`} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                        {point.hoursRows.map((row) => (
                          <div key={row.days} className="contents">
                            <dt className="text-muted">{row.days}</dt>
                            <dd className={`font-mono tabular-nums ${row.hours === "Cerrado" ? "text-muted" : "text-ink"}`}>
                              {row.hours}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 pl-14">
                    <Link
                      href="/pedido"
                      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
                    >
                      Hacer un pedido
                      <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <a
                      href={point.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Cómo llegar a ${point.name} en Google Maps (se abre en otra pestaña)`}
                      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink"
                    >
                      Cómo llegar
                      <ArrowUpRight weight="bold" className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
