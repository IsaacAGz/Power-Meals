"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { MenuCard } from "@/components/MenuBrowser";
import { Reveal } from "@/components/Reveal";
import { formatCents } from "@/lib/format";
import { container, textLink } from "@/lib/ui";

const arrowButton =
  "inline-flex size-11 items-center justify-center rounded-control border border-line-strong text-ink transition-[transform,background-color,color,border-color,opacity] duration-200 ease-out-expo hover:border-ink active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35";

/**
 * Home "Nuestro menú" row. A horizontal scroller that a mouse can drive with the arrow buttons and a keyboard
 * with the arrow keys once the row has focus (native scrolling). Touch swipes as before.
 */
export function MenuCarousel({ items }: { items: MenuCard[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const resize = new ResizeObserver(updateEdges);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      resize.disconnect();
    };
  }, [updateEdges]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    // About one screen of cards; scroll snapping lands it on a card edge.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section className="bg-paper py-24 md:py-32">
      <div className={`${container} flex flex-wrap items-end justify-between gap-6`}>
        <Reveal>
          <h2 id="nuestro-menu" className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Nuestro menú
          </h2>
        </Reveal>
        <div className="flex items-center gap-5">
          <Link href="/menu" className={`${textLink} inline-flex items-center gap-1.5 text-[15px]`}>
            Ver menú
            <ArrowRight weight="bold" className="size-4" />
          </Link>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Platillos anteriores" className={arrowButton}>
              <CaretLeft weight="bold" className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Más platillos" className={arrowButton}>
              <CaretRight weight="bold" className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <Reveal delay={0.1}>
        <div
          ref={scroller}
          role="region"
          aria-labelledby="nuestro-menu"
          tabIndex={0}
          className="no-scrollbar mt-12 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset sm:scroll-px-6 sm:px-6 lg:scroll-px-10 lg:px-10 min-[1400px]:px-[calc((100vw-1400px)/2+2.5rem)]"
        >
          <ul className="flex gap-5">
            {items.map((item) => (
              <li key={item.slug} className="group w-[78vw] max-w-[340px] shrink-0 snap-start">
                <Link href={`/pedido?plantilla=${item.slug}`} className="block rounded-frame">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-frame bg-placeholder">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="340px"
                      className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <h3 className="text-[16px] font-semibold leading-snug">{item.name}</h3>
                    <span className="shrink-0 font-mono text-[15px] tabular-nums text-muted">
                      {formatCents(item.regularCents)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
