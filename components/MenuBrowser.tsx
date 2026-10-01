"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { categories, dishes, formatMXN, type MenuCategory } from "@/lib/menu-data";

type Tab = MenuCategory | "todos";

const tabs: { id: Tab; label: string }[] = [{ id: "todos", label: "Todos" }, ...categories];

export function MenuBrowser() {
  const [active, setActive] = useState<Tab>("todos");
  const reduce = useReducedMotion();
  const visible = active === "todos" ? dishes : dishes.filter((dish) => dish.category === active);
  const featured = active === "todos";

  const columns =
    visible.length === 1 ? "md:grid-cols-2" : visible.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div>
      <div
        role="tablist"
        aria-label="Categorías del menú"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="panel-menu"
              onClick={() => setActive(tab.id)}
              className={`h-10 shrink-0 rounded-control border px-4 text-[15px] font-semibold transition-colors duration-200 active:scale-[0.98] ${
                selected ? "border-ink bg-ink text-cream" : "border-line-strong bg-transparent text-ink hover:border-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <ul
        id="panel-menu"
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className={`mt-10 grid grid-cols-1 gap-x-6 gap-y-12 ${columns}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((dish, index) => {
            const isFeatured = featured && index === 0;
            return (
              <motion.li
                key={dish.slug}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className={`group flex flex-col ${isFeatured ? "lg:col-span-2" : ""}`}
              >
                <div
                  className={`relative overflow-hidden rounded-frame bg-[#EFEADF] ${
                    isFeatured ? "aspect-[4/3] lg:aspect-[16/9]" : "aspect-[4/3]"
                  }`}
                >
                  <Image
                    src={dish.image}
                    alt={dish.name}
                    fill
                    sizes={isFeatured ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
                    className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-5 flex flex-1 flex-col">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className={`font-display font-bold tracking-tight ${isFeatured ? "text-3xl" : "text-2xl"}`}>
                      {dish.name}
                    </h3>
                    <span className="shrink-0 font-mono text-lg tabular-nums">{formatMXN(dish.price)}</span>
                  </div>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">{dish.description}</p>
                  <Link
                    href={`/pedido?platillo=${dish.slug}`}
                    className="group/link mt-4 inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink"
                  >
                    Pedir
                    <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
                  </Link>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
