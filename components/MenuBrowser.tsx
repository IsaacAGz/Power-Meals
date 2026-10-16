"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { formatCents } from "@/lib/format";

export type MenuCard = {
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  filters: string[];
  regularCents: number;
  plusCents: number;
};

export function MenuBrowser({ items, filters }: { items: MenuCard[]; filters: { slug: string; label: string }[] }) {
  const [active, setActive] = useState("todos");
  const reduce = useReducedMotion();
  const tabs = [{ slug: "todos", label: "Todos" }, ...filters];
  const visible = active === "todos" ? items : items.filter((item) => item.filters.includes(active));
  const labelFor = (slug: string) => filters.find((filter) => filter.slug === slug)?.label;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filtros del menú"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const selected = tab.slug === active;
          return (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              id={`tab-${tab.slug}`}
              aria-selected={selected}
              aria-controls="panel-menu"
              onClick={() => setActive(tab.slug)}
              className={`h-10 shrink-0 rounded-control border px-4 text-[15px] font-semibold transition-colors duration-200 active:scale-[0.98] ${
                selected ? "border-ink bg-ink text-cream" : "border-line-strong bg-transparent text-ink hover:border-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id="panel-menu" role="tabpanel" aria-labelledby={`tab-${active}`} className="mt-10">
        {visible.length === 0 ? (
          <p className="rounded-frame border border-dashed border-line-strong p-6 text-[15px] text-muted">
            Pronto tendremos platillos en esta categoría. Mientras tanto, arma el tuyo en{" "}
            <Link href="/pedido" className="font-semibold text-ink underline decoration-power decoration-2 underline-offset-4">
              tu pedido
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((item) => (
                <motion.li
                  key={item.slug}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex flex-col"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-frame bg-[#EFEADF]">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="mt-5 flex flex-1 flex-col">
                    <h3 className="font-display text-2xl font-bold tracking-tight">{item.name}</h3>
                    <p className="mt-2 font-mono text-[15px] tabular-nums">
                      Regular {formatCents(item.regularCents)} <span className="text-muted">·</span> Plus{" "}
                      {formatCents(item.plusCents)}
                    </p>
                    <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">{item.description}</p>
                    {item.filters.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {item.filters.map((slug) => (
                          <li key={slug} className="rounded-control border border-line px-2 py-0.5 text-[12px] font-medium text-muted">
                            {labelFor(slug)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/pedido?plantilla=${item.slug}`}
                      className="group/link mt-4 inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
                    >
                      Pedir
                      <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
                    </Link>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
