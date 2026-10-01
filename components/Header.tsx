"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { buttonPrimary, container } from "@/lib/ui";

const navLinks = [
  { href: "/nosotros", label: "Nosotros" },
  { href: "/menu", label: "Menú" },
  { href: "/ubicaciones", label: "Ubicaciones" },
  { href: "/proyectos", label: "Proyectos" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur-md">
        <div className={`${container} flex h-16 items-center justify-between gap-6`}>
          <Logo />

          <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[15px] font-medium underline-offset-[6px] transition-colors hover:text-ink ${
                    active ? "text-ink underline decoration-power decoration-2" : "text-muted"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/pedido" className={`${buttonPrimary} h-10 px-4 text-sm`}>
              Pedir
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="menu-movil"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              className="inline-flex size-10 items-center justify-center rounded-control border border-line-strong text-ink transition-transform active:scale-[0.96] lg:hidden"
            >
              {open ? <X weight="bold" className="size-5" /> : <List weight="bold" className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <div id="menu-movil" hidden={!open} className="fixed inset-x-0 top-16 bottom-0 z-50 bg-cream lg:hidden">
        <nav aria-label="Móvil" className={`${container} flex flex-col pt-6`}>
          {[{ href: "/", label: "Inicio" }, ...navLinks].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border-b border-line py-4 font-display text-3xl font-bold tracking-tight text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
