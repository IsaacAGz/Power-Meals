import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, schema } from "@/lib/db";
import { sendKitchenTicket } from "@/lib/kitchen/dispatch";
import { getKitchenBoard, getKitchenTicket } from "@/lib/kitchen/orders";
import { advanceKitchenOrderStatus } from "@/lib/kitchen/transition";
import { sendOrderNotification } from "@/lib/orders/notify";
import { createUser, facilityId } from "../helpers/factory";
import { sentEmails } from "../helpers/outbox";
import { orderRow, outboxFor, placeWhatsAppOrder } from "../helpers/orders";

const published: unknown[] = [];
vi.mock("@/lib/sqs", () => ({
  isKitchenQueueConfigured: () => Boolean(process.env.SQS_QUEUE_URL),
  publishKitchenTicket: async (ticket: unknown) => {
    published.push(ticket);
    return `msg-${published.length}`;
  },
}));

afterEach(() => {
  published.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function staffAt(slug: string) {
  return createUser({ staffAt: slug, email: `cocina-${slug}@powermeals.test` });
}

describe("advanceKitchenOrderStatus", () => {
  it("marks a WhatsApp order paid once, with one ticket and one message in the same commit", async () => {
    const order = await placeWhatsAppOrder({ punto: "otay" });
    const staff = await staffAt("otay");

    const result = await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");
    expect(result).toEqual({ ok: true, status: "paid", becamePaid: true });

    const row = await orderRow(order.id);
    expect(row.status).toBe("paid");
    expect(row.paidAt).toBeInstanceOf(Date);
    const { payments, events, dispatches, notifications } = await outboxFor(order.id);
    expect(payments).toMatchObject([{ status: "succeeded" }]);
    expect(events.at(-1)).toMatchObject({ fromStatus: "ordered_whatsapp", toStatus: "paid", changedByUserId: staff.id });
    // No SQS_QUEUE_URL: stored as skipped so turning the queue on later does not print it.
    expect(dispatches).toMatchObject([{ status: "skipped", lastError: "SQS_QUEUE_URL is not set" }]);
    expect(notifications).toMatchObject([{ channel: "email", destination: "mariana@example.com", status: "pending" }]);
  });

  it("treats a double click as a no-op instead of a second payment", async () => {
    const order = await placeWhatsAppOrder();
    const staff = await staffAt("otay");
    await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");
    const again = await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");

    expect(again).toEqual({ ok: true, status: "paid", becamePaid: false });
    const { dispatches, notifications, events } = await outboxFor(order.id);
    expect(dispatches).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(events).toHaveLength(2);
  });

  it("refuses an order from another kitchen", async () => {
    const order = await placeWhatsAppOrder({ punto: "otay" });
    const staff = await staffAt("zona-rio");
    const result = await advanceKitchenOrderStatus(await facilityId("zona-rio"), staff.id, order.id, "ordered_whatsapp");
    expect(result).toEqual({ ok: false, message: "Este pedido no está en tu cocina." });
    expect((await orderRow(order.id)).status).toBe("ordered_whatsapp");
  });

  it("refuses a stale step and a malformed id", async () => {
    const order = await placeWhatsAppOrder();
    const staff = await staffAt("otay");
    expect(await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "preparing")).toMatchObject({ ok: false });
    expect(await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, "not-a-uuid", "ordered_whatsapp")).toMatchObject({
      ok: false,
    });
    expect(await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "completed")).toMatchObject({ ok: false });
  });

  it("walks to completed without sending or printing again", async () => {
    const order = await placeWhatsAppOrder();
    const staff = await staffAt("otay");
    for (const from of ["ordered_whatsapp", "paid", "preparing", "ready"] as const) {
      expect(await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, from)).toMatchObject({ ok: true });
    }
    expect((await orderRow(order.id)).status).toBe("completed");
    const { dispatches, notifications, events } = await outboxFor(order.id);
    expect(dispatches).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(events.map((event) => event.toStatus)).toEqual(["ordered_whatsapp", "paid", "preparing", "ready", "completed"]);
  });

  it("queues and publishes the ticket when SQS is configured", async () => {
    vi.stubEnv("SQS_QUEUE_URL", "https://sqs.test/power-meals-kitchen");
    const order = await placeWhatsAppOrder();
    const staff = await staffAt("otay");
    await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");

    expect(await sendKitchenTicket(order.id)).toBe("sent");
    expect(await sendKitchenTicket(order.id)).toBe("not_pending");
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ orderId: order.id, facilityName: "Otay", paymentMethod: "whatsapp" });
    const { dispatches } = await outboxFor(order.id);
    expect(dispatches).toMatchObject([{ status: "sent", attempts: 1, sqsMessageId: "msg-1" }]);
  });
});

describe("paid-order notification", () => {
  it("emails the receipt link once", async () => {
    const order = await placeWhatsAppOrder();
    const staff = await staffAt("otay");
    await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");

    expect(await sendOrderNotification(order.id)).toBe("sent");
    expect(await sendOrderNotification(order.id)).toBe("not_pending");
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toMatchObject({ to: "mariana@example.com", subject: `Pedido #${order.orderNumber} pagado` });
    expect(sentEmails[0].text).toContain(`/pedido/success?order_ref=${order.publicOrderRef}`);
  });

  it("uses WhatsApp when the order has no email, and skips it while WhatsApp is off", async () => {
    const order = await placeWhatsAppOrder({ email: "" });
    const staff = await staffAt("otay");
    await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");
    const { notifications } = await outboxFor(order.id);
    expect(notifications).toMatchObject([{ channel: "whatsapp", destination: "664 123 4567", status: "skipped" }]);
    expect(await sendOrderNotification(order.id)).toBe("not_pending");
  });

  it("sends the WhatsApp template when configured and keeps a failed send pending", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WHATSAPP_TEMPLATE_NAME", "pedido_pagado");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: { message: "Meta is down" } }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ messages: [{ id: "wamid" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const order = await placeWhatsAppOrder({ email: "" });
    const staff = await staffAt("otay");
    await advanceKitchenOrderStatus(order.kitchenFacilityId, staff.id, order.id, "ordered_whatsapp");

    expect(await sendOrderNotification(order.id)).toBe("pending");
    expect((await outboxFor(order.id)).notifications).toMatchObject([{ status: "pending", attempts: 1, lastError: "Meta is down" }]);
    expect(await sendOrderNotification(order.id)).toBe("sent");

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.to).toBe("526641234567");
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      "Mariana",
      String(order.orderNumber),
      `http://localhost:3000/pedido/success?order_ref=${order.publicOrderRef}`,
    ]);
  });
});

describe("getKitchenBoard and getKitchenTicket", () => {
  it("shows only this kitchen's orders, with the phone for staff", async () => {
    const otay = await placeWhatsAppOrder({ punto: "otay" });
    await placeWhatsAppOrder({ punto: "zona-rio" });

    const board = await getKitchenBoard(await facilityId("otay"));
    expect(board.facilityName).toBe("Otay");
    expect(board.orders.map((order) => order.id)).toEqual([otay.id]);
    expect(board.orders[0]).toMatchObject({ customerPhone: "664 123 4567", status: "ordered_whatsapp", place: "Otay" });
    expect(board.counts.ordered_whatsapp).toBe(1);
  });

  it("keeps pending_payment and cancelled orders off the board", async () => {
    const order = await placeWhatsAppOrder();
    await getDb().update(schema.orders).set({ status: "cancelled" }).where(eq(schema.orders.id, order.id));
    expect((await getKitchenBoard(order.kitchenFacilityId)).orders).toEqual([]);
  });

  it("builds the printed ticket with each line's grams and salsa", async () => {
    const order = await placeWhatsAppOrder();
    const ticket = await getKitchenTicket(order.id);
    expect(ticket).toMatchObject({ orderId: order.id, orderNumber: order.orderNumber, totalCents: 2 * 13_900, place: "Otay" });
    expect(ticket?.lines[0]).toMatchObject({ quantity: 2, name: "Pollo + arroz + veggies · Regular" });
    expect(ticket?.lines[0].detail).toMatch(/130 g/);
    expect(ticket?.lines[0].detail).toMatch(/Salsa roja/i);
  });
});
