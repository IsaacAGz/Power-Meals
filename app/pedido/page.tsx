import type { Metadata } from "next";
import { Bank, ChatCircleText, Package } from "@phosphor-icons/react/dist/ssr";
import { OrderForm } from "@/components/OrderForm";
import { container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Pedido",
  description: "Arma tu pedido de Power Meals y envíalo por WhatsApp. El pago se confirma por transferencia bancaria.",
};

const steps = [
  { icon: ChatCircleText, text: "Envías tu pedido por WhatsApp con el botón del formulario." },
  { icon: Bank, text: "Te confirmamos y te compartimos los datos para la transferencia." },
  { icon: Package, text: "Con tu pago confirmado, agendamos entrega o recolección." },
];

const bankRows = [
  { label: "Banco", value: "Te lo enviamos por WhatsApp" },
  { label: "CLABE", value: "Te la enviamos por WhatsApp" },
  { label: "Titular", value: "Power Meals" },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function PaymentDetails({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <ol className="flex flex-col gap-5">
        {steps.map((step) => (
          <li key={step.text} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-frame border border-line-strong bg-paper">
              <step.icon weight="bold" className="size-5" aria-hidden />
            </span>
            <span className="pt-2 text-[15px] leading-relaxed text-ink">{step.text}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-frame bg-ink p-6 text-cream">
        <h2 className="font-display text-xl font-bold tracking-tight">Pago por transferencia bancaria</h2>
        <dl className="mt-5 flex flex-col gap-3">
          {bankRows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-sm text-cream/70">{row.label}</dt>
              <dd className="text-sm font-medium text-cream">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 border-t border-cream/15 pt-4 text-[13px] leading-relaxed text-cream/70">
          No cobramos con tarjeta en línea. Tu pedido queda confirmado al recibir la transferencia.
        </p>
      </div>
    </div>
  );
}

export default async function PedidoPage({ searchParams }: PageProps<"/pedido">) {
  const params = await searchParams;

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={`${container} grid gap-12 lg:grid-cols-[4fr_7fr] lg:gap-20`}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Haz tu pedido</h1>
          <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted">
            Llena el formulario y lo abrimos en WhatsApp ya escrito. El pago se confirma por transferencia bancaria.
          </p>
          <PaymentDetails className="mt-10 hidden lg:block" />
        </aside>

        <div>
          <OrderForm
            initialZona={first(params.zona)}
            initialPlatillo={first(params.platillo)}
            initialPunto={first(params.punto)}
          />
          <PaymentDetails className="mt-16 lg:hidden" />
        </div>
      </div>
    </section>
  );
}
