import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { ChatCircleText, CreditCard, ForkKnife, Package, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { OrderExperience, type RecentOrder } from "@/components/order/OrderExperience";
import { getCurrentUser } from "@/lib/auth/dal";
import { currentCartOwner, getPricedCart } from "@/lib/cart";
import { toCartView } from "@/lib/cart/view";
import { getCatalog } from "@/lib/catalog";
import { getDb, schema } from "@/lib/db";
import { isOpenpayConfigured } from "@/lib/openpay";
import { container } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const card = isOpenpayConfigured();
  return {
    title: "Pedido",
    description: card
      ? "Arma tus platillos o elige un paquete de Power Meals. Paga con tarjeta en Openpay o por WhatsApp."
      : "Arma tus platillos o elige un paquete de Power Meals. Envía tu pedido por WhatsApp y paga por transferencia.",
  };
}

function PaymentDetails({ openpayEnabled, className = "" }: { openpayEnabled: boolean; className?: string }) {
  const steps = openpayEnabled
    ? [
        { icon: ForkKnife, text: "Arma tus platillos o elige un paquete POWER." },
        { icon: CreditCard, text: "Paga con tarjeta en la página segura de Openpay." },
        { icon: Package, text: "Con tu pago confirmado, agendamos entrega o recolección." },
      ]
    : [
        { icon: ForkKnife, text: "Arma tus platillos o elige un paquete POWER." },
        { icon: WhatsappLogo, text: "Envía tu pedido por WhatsApp." },
        { icon: Package, text: "Te compartimos los datos para la transferencia y agendamos entrega o recolección." },
      ];

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
        {openpayEnabled ? (
          <>
            <h2 className="font-display text-xl font-bold tracking-tight">Pago seguro con Openpay</h2>
            <p className="mt-3 text-sm leading-relaxed text-cream/75">
              Escribes los datos de tu tarjeta en la página de Openpay; nunca pasan por nuestro sitio.
            </p>
            <p className="mt-5 flex gap-2 border-t border-cream/15 pt-4 text-[13px] leading-relaxed text-cream/70">
              <ChatCircleText weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
              ¿Prefieres transferencia? Envía tu pedido por WhatsApp y te compartimos los datos bancarios.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold tracking-tight">Pago por transferencia</h2>
            <p className="mt-3 text-sm leading-relaxed text-cream/75">
              Envías tu pedido por WhatsApp y te compartimos los datos bancarios. El pago con tarjeta todavía no está disponible.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

async function recentOrdersFor(userId: string): Promise<RecentOrder[]> {
  const db = getDb();
  const orders = await db
    .select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber, totalCents: schema.orders.totalCents })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), notInArray(schema.orders.status, ["pending_payment", "cancelled"])))
    .orderBy(desc(schema.orders.createdAt))
    .limit(4);
  if (orders.length === 0) return [];

  const lines = await db
    .select({ orderId: schema.orderLineItems.orderId, name: schema.orderLineItems.displayName, quantity: schema.orderLineItems.quantity })
    .from(schema.orderLineItems)
    .where(and(inArray(schema.orderLineItems.orderId, orders.map((order) => order.id)), isNull(schema.orderLineItems.parentLineId)))
    .orderBy(asc(schema.orderLineItems.sortOrder));

  return orders.map((order) => ({
    ...order,
    summary: lines
      .filter((line) => line.orderId === order.id)
      .map((line) => `${line.quantity}× ${line.name}`)
      .join(", "),
  }));
}

export default async function PedidoPage({ searchParams }: PageProps<"/pedido">) {
  const params = await searchParams;
  const db = getDb();
  const [catalog, user, owner, zones, points] = await Promise.all([
    getCatalog(),
    getCurrentUser(),
    currentCartOwner(),
    db
      .select({ slug: schema.deliveryZones.slug, name: schema.deliveryZones.name, days: schema.deliveryZones.deliveryDaysLabel })
      .from(schema.deliveryZones)
      .where(eq(schema.deliveryZones.isActive, true))
      .orderBy(asc(schema.deliveryZones.name)),
    db
      .select({ slug: schema.pickupPoints.slug, name: schema.pickupPoints.name, address: schema.pickupPoints.address })
      .from(schema.pickupPoints)
      .where(eq(schema.pickupPoints.isActive, true))
      .orderBy(asc(schema.pickupPoints.name)),
  ]);
  const [cart, recentOrders] = await Promise.all([
    getPricedCart(owner),
    user ? recentOrdersFor(user.id) : Promise.resolve([]),
  ]);

  const zone = param(params.zona);
  const point = param(params.punto);
  const openpayEnabled = isOpenpayConfigured();

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={`${container} grid gap-12 lg:grid-cols-[4fr_7fr] lg:gap-20`}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Haz tu pedido</h1>
          <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-muted">
            {openpayEnabled
              ? "Arma cada platillo a tu gusto o elige un paquete para la semana. Pagas con tarjeta en Openpay."
              : "Arma cada platillo a tu gusto o elige un paquete para la semana. Envías el pedido por WhatsApp."}
          </p>
          <PaymentDetails openpayEnabled={openpayEnabled} className="mt-10 hidden lg:block" />
        </aside>

        <div>
          <OrderExperience
            catalog={catalog}
            initialCart={toCartView(cart)}
            zones={zones}
            points={points}
            prefill={{ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }}
            recentOrders={recentOrders}
            initial={{
              template: param(params.plantilla),
              package: param(params.paquete),
              zone: zones.some((row) => row.slug === zone) ? zone : undefined,
              point: points.some((row) => row.slug === point) ? point : undefined,
            }}
            openpayEnabled={openpayEnabled}
            signedIn={user !== null}
          />
          <PaymentDetails openpayEnabled={openpayEnabled} className="mt-16 lg:hidden" />
        </div>
      </div>
    </section>
  );
}
