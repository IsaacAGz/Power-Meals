import "server-only";
import { eq } from "drizzle-orm";
import { clearUserCart } from "@/lib/cart";
import type { ResolvedLine, ResolvedMeal } from "@/lib/catalog/pricing";
import { getDb, schema, type Database } from "@/lib/db";
import { generatePublicOrderRef } from "./ref";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type PendingOrderInput = {
  userId: string | null;
  customer: { name: string; email: string; phone: string };
  fulfillment: { type: "delivery"; zoneId: string; address: string } | { type: "pickup"; pickupPointId: string };
  kitchenFacilityId: string;
  notes: string | null;
  lines: ResolvedLine[];
};

const composition = (meal: ResolvedMeal) => ({
  proteinId: meal.protein.id,
  carbBaseId: meal.base.id,
  portionSize: meal.portion.size,
  plateStyle: meal.style,
  proteinGrams: meal.proteinGrams,
  carbGrams: meal.carbGrams,
  vegGrams: meal.vegGrams,
  salsaNote: meal.salsaNote,
  templateId: meal.template?.id ?? null,
});

async function insertOrderLines(tx: Tx, orderId: string, lines: ResolvedLine[]) {
  let sortOrder = 0;
  for (const line of lines) {
    const shared = {
      orderId,
      quantity: line.quantity,
      displayName: line.displayName,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      item: line.item,
      sortOrder: sortOrder++,
    };

    if (!line.package) {
      await tx.insert(schema.orderLineItems).values({ ...shared, kind: "meal", ...composition(line.meals[0]) });
      continue;
    }

    const [header] = await tx
      .insert(schema.orderLineItems)
      .values({ ...shared, kind: "package", packageId: line.package.id, portionSize: line.package.size })
      .returning({ id: schema.orderLineItems.id });
    await tx.insert(schema.orderLineItems).values(
      line.meals.map((meal) => ({
        orderId,
        parentLineId: header.id,
        kind: "package_slot" as const,
        sortOrder: sortOrder++,
        quantity: line.quantity,
        displayName: meal.name,
        unitPriceCents: 0,
        lineTotalCents: 0,
        packageId: line.package!.id,
        ...composition(meal),
      })),
    );
  }
}

async function insertOrder(tx: Tx, input: PendingOrderInput, status: "pending_payment" | "ordered_whatsapp") {
  const totalCents = input.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const publicOrderRef = generatePublicOrderRef();
  const [order] = await tx
    .insert(schema.orders)
    .values({
      publicOrderRef,
      userId: input.userId,
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      status,
      fulfillmentType: input.fulfillment.type,
      deliveryZoneId: input.fulfillment.type === "delivery" ? input.fulfillment.zoneId : null,
      deliveryAddress: input.fulfillment.type === "delivery" ? input.fulfillment.address : null,
      pickupPointId: input.fulfillment.type === "pickup" ? input.fulfillment.pickupPointId : null,
      kitchenFacilityId: input.kitchenFacilityId,
      subtotalCents: totalCents,
      totalCents,
      notes: input.notes,
    })
    .returning({ id: schema.orders.id, orderNumber: schema.orders.orderNumber });

  await insertOrderLines(tx, order.id, input.lines);
  await tx.insert(schema.orderStatusEvents).values({ orderId: order.id, toStatus: status });
  await tx.insert(schema.payments).values({
    orderId: order.id,
    amountCents: totalCents,
    provider: status === "ordered_whatsapp" ? "whatsapp" : "openpay",
  });
  if (status === "ordered_whatsapp" && input.userId) await clearUserCart(tx, input.userId);

  return { id: order.id, orderNumber: order.orderNumber, publicOrderRef, totalCents };
}

/** Inserts the order (pending_payment), its frozen line snapshot, and a pending payment row in one transaction. */
export async function createPendingOrder(input: PendingOrderInput) {
  return getDb().transaction((tx) => insertOrder(tx, input, "pending_payment"));
}

/** A placed WhatsApp order. It is not paid: paid_at stays null and the payment row stays pending. */
export async function createWhatsAppOrder(input: PendingOrderInput & { userId: string }) {
  return getDb().transaction((tx) => insertOrder(tx, input, "ordered_whatsapp"));
}

export async function attachChargeToOrder(orderId: string, chargeId: string) {
  await getDb().update(schema.payments).set({ openpayChargeId: chargeId }).where(eq(schema.payments.orderId, orderId));
}

/** Charge creation failed before the customer reached Openpay; nothing was charged. */
export async function abandonOrder(orderId: string) {
  await getDb().transaction(async (tx) => {
    await tx.update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, orderId));
    await tx.update(schema.payments).set({ status: "failed" }).where(eq(schema.payments.orderId, orderId));
    await tx
      .insert(schema.orderStatusEvents)
      .values({ orderId, fromStatus: "pending_payment", toStatus: "cancelled" });
  });
}
