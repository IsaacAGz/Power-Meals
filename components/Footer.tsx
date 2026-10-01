import Link from "next/link";
import { Logo } from "./Logo";
import { WhatsAppButton } from "./WhatsAppButton";
import { container } from "@/lib/ui";
import { WHATSAPP_DISPLAY } from "@/lib/whatsapp";

const links = [
  { href: "/nosotros", label: "Nosotros" },
  { href: "/menu", label: "Menú y precios" },
  { href: "/ubicaciones", label: "Ubicaciones" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/pedido", label: "Pedir" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper">
      <div className={`${container} grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div className="flex flex-col items-start gap-5">
          <Logo />
          <p className="max-w-[36ch] text-[15px] leading-relaxed text-muted">
            Comida real. Energía real. Resultados reales. Cocina de meal prep en Tijuana, Baja California.
          </p>
        </div>

        <nav aria-label="Pie de página" className="flex flex-col gap-3 text-[15px]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="w-fit text-muted transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col items-start gap-4">
          <p className="text-[15px] text-muted">
            WhatsApp <span className="font-medium text-ink tabular-nums">{WHATSAPP_DISPLAY}</span>
          </p>
          <WhatsAppButton />
        </div>
      </div>

      <div className="border-t border-line">
        <p className={`${container} py-6 text-[13px] text-muted`}>
          © {year} Power Meals. Precios en MXN. Pagos por transferencia bancaria, confirmados por WhatsApp.
        </p>
      </div>
    </footer>
  );
}
