import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { requireUser } from "@/lib/auth/dal";
import { buttonPrimary, container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false },
};

const roleLabels = {
  customer: "Cliente",
  kitchen_staff: "Cocina",
  admin: "Administración",
} as const;

export default async function CuentaPage() {
  const user = await requireUser("/cuenta");
  const isKitchen = user.role === "kitchen_staff";

  const rows = [
    { label: "Nombre", value: user.name },
    { label: "Correo", value: user.email },
    { label: "Teléfono", value: user.phone ?? "Sin teléfono" },
    { label: "Tipo de cuenta", value: roleLabels[user.role] },
  ];

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto max-w-[760px]">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Mi cuenta</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">Hola, {user.name.split(" ")[0]}.</p>

          <dl className="mt-10 divide-y divide-line rounded-frame border border-line-strong bg-paper">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="text-[15px] font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={isKitchen ? "/kitchen/dashboard" : "/historial"} className={buttonPrimary}>
              {isKitchen ? "Panel de cocina" : "Mis pedidos"}
              <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
    </section>
  );
}
