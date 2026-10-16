import "server-only";
import { eq } from "drizzle-orm";
import type { ResolvedLine, ResolvedMeal } from "@/lib/catalog/pricing";
import { getDb, schema } from "@/lib/db";
import { generatePublicOrderRef } from "./ref";

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

/** Inserts the order (pending_payment), its frozen line snapshot, and a pending payment row in one transaction. */
export async function createPendingOrder(input: PendingOrderInput) {
  const totalCents = input.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const publicOrderRef = generatePublicOrderRef();

  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .insert(schema.orders)
      .values({
        publicOrderRef,
        userId: input.userId,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
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

    let sortOrder = 0;
    for (const line of input.lines) {
      const shared = {
        orderId: order.id,
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
          orderId: order.id,
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

    await tx.insert(schema.orderStatusEvents).values({ orderId: order.id, toStatus: "pending_payment" });
    await tx.insert(schema.payments).values({ orderId: order.id, amountCents: totalCents });

    return { id: order.id, orderNumber: order.orderNumber, publicOrderRef, totalCents };
  });
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
