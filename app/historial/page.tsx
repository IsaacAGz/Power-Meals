import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { formatMXN } from "@/lib/menu-data";
import { buttonPrimary, container } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Mis pedidos",
  robots: { index: false },
};

const statusLabels: Record<(typeof schema.orderStatus.enumValues)[number], string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Entregado",
  cancelled: "Cancelado",
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Tijuana" });

export default async function HistorialPage() {
  const user = await requireUser("/historial");

  const orders = await getDb()
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      status: schema.orders.status,
      fulfillmentType: schema.orders.fulfillmentType,
      totalCents: schema.orders.totalCents,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(50);

  return (
    <section className="pt-12 pb-24 md:pt-20 md:pb-32">
      <div className={container}>
        <div className="mx-auto max-w-[760px]">
          <h1 className="font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Mis pedidos</h1>

          {orders.length === 0 ? (
            <div className="mt-10 rounded-frame border border-line-strong bg-paper p-6 sm:p-8">
              <p className="text-lg font-semibold text-ink">Aún no tienes pedidos en tu cuenta.</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Los pedidos que pagues con tu cuenta aparecerán aquí para que puedas repetirlos.
              </p>
              <Link href="/pedido" className={`${buttonPrimary} mt-6`}>
                Hacer un pedido
              </Link>
            </div>
          ) : (
            <ul className="mt-10 divide-y divide-line rounded-frame border border-line-strong bg-paper">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5">
                  <div>
                    <p className="font-display text-xl font-bold tracking-tight">Pedido #{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted">
                      {dateFormat.format(order.createdAt)} ·{" "}
                      {order.fulfillmentType === "delivery" ? "Entrega" : "Recolección"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[15px] tabular-nums">{formatMXN(order.totalCents / 100)}</p>
                    <p className="mt-1 text-sm font-medium text-ink">{statusLabels[order.status]}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
