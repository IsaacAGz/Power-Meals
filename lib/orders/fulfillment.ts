import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CheckoutInput } from "./checkout-input";
import type { PendingOrderInput } from "./create";

export type ResolvedFulfillment = Pick<PendingOrderInput, "fulfillment" | "kitchenFacilityId">;

/** Resolves the posted zone or pickup point to an active row and its kitchen. */
export async function resolveFulfillment(input: CheckoutInput): Promise<ResolvedFulfillment | undefined> {
  const db = getDb();
  if (input.metodo === "entrega") {
    const [zone] = await db
      .select({ id: schema.deliveryZones.id, facilityId: schema.deliveryZones.kitchenFacilityId })
      .from(schema.deliveryZones)
      .where(and(eq(schema.deliveryZones.slug, input.zona), eq(schema.deliveryZones.isActive, true)));
    return zone && {
      fulfillment: { type: "delivery", zoneId: zone.id, address: input.direccion },
      kitchenFacilityId: zone.facilityId,
    };
  }
  const [point] = await db
    .select({ id: schema.pickupPoints.id, facilityId: schema.pickupPoints.kitchenFacilityId })
    .from(schema.pickupPoints)
    .where(and(eq(schema.pickupPoints.slug, input.punto), eq(schema.pickupPoints.isActive, true)));
  return point && { fulfillment: { type: "pickup", pickupPointId: point.id }, kitchenFacilityId: point.facilityId };
}
