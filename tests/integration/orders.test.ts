import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getPricedCart } from "@/lib/cart";
import { getDb, schema } from "@/lib/db";
import { readCheckoutInput } from "@/lib/orders/checkout-input";
import { resolveFulfillment } from "@/lib/orders/fulfillment";
import { meal, slots } from "../fixtures/catalog";
import { addToCart, createUser, facilityId, pickupBody, signIn } from "../helpers/factory";
import { orderRow, outboxFor, placeWhatsAppOrder } from "../helpers/orders";

describe("resolveFulfillment", () => {
  it.each(["zona-rio", "otay", "plaza-monarca", "rio-tijuana-3ra-etapa"])("assigns %s pickup to that kitchen", async (slug) => {
    const target = await resolveFulfillment(readCheckoutInput(pickupBody({ punto: slug })));
    expect(target?.kitchenFacilityId).toBe(await facilityId(slug));
    expect(target?.fulfillment.type).toBe("pickup");
  });

  it("offers exactly the four kitchens as active pickup points", async () => {
    const points = await getDb()
      .select({ slug: schema.pickupPoints.slug })
      .from(schema.pickupPoints)
      .where(eq(schema.pickupPoints.isActive, true))
      .orderBy(asc(schema.pickupPoints.slug));
    expect(points.map((row) => row.slug)).toEqual(["otay", "plaza-monarca", "rio-tijuana-3ra-etapa", "zona-rio"]);
  });

  it("does not resolve delivery or an unknown point", async () => {
    expect(await resolveFulfillment(readCheckoutInput(pickupBody({ metodo: "entrega", zona: "otay", direccion: "Calle 1" })))).toBeUndefined();
    expect(await resolveFulfillment(readCheckoutInput(pickupBody({ punto: "recoleccion-playas" })))).toBeUndefined();
  });
});

describe("createWhatsAppOrder", () => {
  it("writes the order, frozen lines, a pending payment, and the first event, then clears the cart", async () => {
    const owner = await signIn((await createUser()).id);
    await addToCart(owner, meal({ protein: "salmon" }), 2);
    await addToCart(owner, { kind: "package", package: "power-mix-6-regular", slots: [...slots(5), ...slots(1, { protein: "asada" })] });

    const order = await placeWhatsAppOrder({ owner, punto: "plaza-monarca" });
    const row = await orderRow(order.id);
    expect(row).toMatchObject({
      status: "ordered_whatsapp",
      paidAt: null,
      fulfillmentType: "pickup",
      kitchenFacilityId: await facilityId("plaza-monarca"),
      totalCents: 2 * (13_900 + 7_500) + 74_900 + 2_500,
    });
    expect(order.publicOrderRef).toHaveLength(43);

    const lines = await getDb()
      .select()
      .from(schema.orderLineItems)
      .where(eq(schema.orderLineItems.orderId, order.id))
      .orderBy(asc(schema.orderLineItems.sortOrder));
    const header = lines.find((line) => line.kind === "package")!;
    const slotRows = lines.filter((line) => line.kind === "package_slot");
    expect(lines.filter((line) => line.kind === "meal")).toHaveLength(1);
    expect(slotRows).toHaveLength(6);
    expect(slotRows.every((line) => line.parentLineId === header.id && line.lineTotalCents === 0)).toBe(true);
    expect(header.lineTotalCents).toBe(74_900 + 2_500);

    const { payments, events, dispatches, notifications } = await outboxFor(order.id);
    expect(payments).toMatchObject([{ provider: "whatsapp", status: "pending", amountCents: row.totalCents }]);
    expect(events).toMatchObject([{ fromStatus: null, toStatus: "ordered_whatsapp" }]);
    expect(dispatches).toEqual([]);
    expect(notifications).toEqual([]);
    expect(await getPricedCart(owner)).toEqual([]);
  });

  it("prices from the database, not from anything the client sent", async () => {
    const owner = await signIn((await createUser()).id);
    await addToCart(owner, meal(), 1);
    await getDb()
      .update(schema.cartLineItems)
      .set({ item: { ...meal(), unitPriceCents: 1 } })
      .where(eq(schema.cartLineItems.userId, owner.userId));
    const order = await placeWhatsAppOrder({ owner });
    expect(order.totalCents).toBe(13_900);
  });
});
