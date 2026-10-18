import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { CheckoutInput } from "./checkout-input";
import type { PendingOrderInput } from "./create";

export type ResolvedFulfillment = Pick<PendingOrderInput, "fulfillment" | "kitchenFacilityId">;

/** Resolves a pickup point to its kitchen. Delivery is off, so a posted entrega does not resolve. */
export async function resolveFulfillment(input: CheckoutInput): Promise<ResolvedFulfillment | undefined> {
  if (input.metodo === "entrega") return undefined;

  const [point] = await getDb()
    .select({ id: schema.pickupPoints.id, facilityId: schema.pickupPoints.kitchenFacilityId })
    .from(schema.pickupPoints)
    .where(and(eq(schema.pickupPoints.slug, input.punto), eq(schema.pickupPoints.isActive, true)));
  return point && { fulfillment: { type: "pickup", pickupPointId: point.id }, kitchenFacilityId: point.facilityId };
}
