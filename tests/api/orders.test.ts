import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as getCart, POST as addCart, PUT as setCart } from "@/app/api/cart/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { GET as kitchenOrders } from "@/app/api/kitchen/orders/route";
import { GET as publicStatus } from "@/app/api/orders/public-status/route";
import { POST as whatsAppOrder } from "@/app/api/orders/whatsapp/route";
import type { CartView } from "@/lib/cart/view";
import { whatsAppOrderKey } from "@/lib/cart/keys";
import { getDb, schema } from "@/lib/db";
import type { KitchenBoard } from "@/lib/kitchen/types";
import { getRedis } from "@/lib/redis";
import { meal } from "../fixtures/catalog";
import { sessionCookie } from "../helpers/cookies";
import { addToCart, createUser, guest, json, pickupBody, post, signIn } from "../helpers/factory";
import { placeWhatsAppOrder } from "../helpers/orders";

describe("/api/cart", () => {
  it("adds, sets, and reads a guest cart with server prices", async () => {
    const added = await json<CartView>(await addCart(post("/api/cart", { item: meal(), quantity: 2 })));
    expect(added).toMatchObject({ totalCents: 2 * 13_900, mealCount: 2 });
    expect(sessionCookie()).toBeDefined();

    const set = await setCart(new Request(post("/api/cart", { item: meal(), quantity: 5 }), { method: "PUT" }));
    expect((await json<CartView>(set)).lines[0].quantity).toBe(5);
    expect((await json<CartView>(await getCart())).totalCents).toBe(5 * 13_900);
  });

  it("rejects a malformed item, an unsold combination, and a cross-site request", async () => {
    expect((await addCart(post("/api/cart", { item: { kind: "dish" }, quantity: 1 }))).status).toBe(400);
    const unsold = await addCart(post("/api/cart", { item: meal({ base: "ensalada", style: "double_carb" }), quantity: 1 }));
    expect(unsold.status).toBe(400);
    expect(await json(unsold)).toEqual({ message: "Esta combinación no está disponible." });
    expect((await addCart(post("/api/cart", { item: meal(), quantity: 1 }, { origin: "https://evil.com" }))).status).toBe(403);
  });
});

describe("POST /api/orders/whatsapp", () => {
  it("saves a signed-in order as ordered_whatsapp", async () => {
    const user = await createUser();
    const owner = await signIn(user.id);
    await addToCart(owner, meal(), 1);

    const response = await whatsAppOrder(post("/api/orders/whatsapp", pickupBody({ punto: "zona-rio" })));
    expect(await json(response)).toEqual({ ok: true, saved: true });
    const orders = await getDb().select().from(schema.orders).where(eq(schema.orders.userId, user.id));
    expect(orders).toMatchObject([{ status: "ordered_whatsapp", customerEmail: user.email, totalCents: 13_900 }]);
  });

  it("only remembers a guest order on the session", async () => {
    const visitor = await guest();
    await addToCart(visitor, meal(), 1);
    const response = await whatsAppOrder(post("/api/orders/whatsapp", pickupBody()));
    expect(await json(response)).toEqual({ ok: true, saved: false });
    expect(await getDb().select().from(schema.orders)).toEqual([]);
    expect(await getRedis().exists(whatsAppOrderKey(visitor.sessionId))).toBe(1);
  });

  it("rejects delivery, an empty cart, and an unknown pickup point", async () => {
    const owner = await signIn((await createUser()).id);
    expect((await whatsAppOrder(post("/api/orders/whatsapp", pickupBody()))).status).toBe(400);

    await addToCart(owner, meal(), 1);
    const delivery = await whatsAppOrder(post("/api/orders/whatsapp", pickupBody({ metodo: "entrega", zona: "otay", direccion: "Calle 1" })));
    expect(delivery.status).toBe(400);
    expect((await whatsAppOrder(post("/api/orders/whatsapp", pickupBody({ punto: "playas" })))).status).toBe(400);
    expect(await getDb().select().from(schema.orders)).toEqual([]);
  });
});

describe("POST /api/checkout", () => {
  it("is unavailable while Openpay is off", async () => {
    const owner = await signIn((await createUser()).id);
    await addToCart(owner, meal(), 1);
    const response = await checkout(post("/api/checkout", pickupBody({ correo: "a@b.mx" })));
    expect(response.status).toBe(503);
    expect(await getDb().select().from(schema.orders)).toEqual([]);
  });
});

describe("GET /api/orders/public-status", () => {
  const statusRequest = (ref: string) =>
    new NextRequest(`http://localhost:3000/api/orders/public-status?order_ref=${encodeURIComponent(ref)}`, {
      headers: { "x-real-ip": "10.0.0.2" },
    });

  it("returns the public status without customer details", async () => {
    const order = await placeWhatsAppOrder();
    const response = await publicStatus(statusRequest(order.publicOrderRef));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await json(response)).toEqual({ status: "whatsapp", origin: "whatsapp", paidAt: null });
  });

  it("answers 404 for a malformed or unknown ref", async () => {
    expect((await publicStatus(statusRequest("short"))).status).toBe(404);
    expect((await publicStatus(statusRequest("a".repeat(43)))).status).toBe(404);
  });
});

describe("GET /api/kitchen/orders", () => {
  it("redirects anonymous visitors to sign in", async () => {
    await expect(kitchenOrders()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  it("is not found for customers", async () => {
    await signIn((await createUser()).id);
    await expect(kitchenOrders()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });

  it("returns only the staff member's kitchen", async () => {
    const otay = await placeWhatsAppOrder({ punto: "otay" });
    await placeWhatsAppOrder({ punto: "plaza-monarca" });
    await signIn((await createUser({ staffAt: "otay", email: "cocina@powermeals.test" })).id);

    const response = await kitchenOrders();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const board = await json<KitchenBoard>(response);
    expect(board.facilityName).toBe("Otay");
    expect(board.orders.map((order) => order.id)).toEqual([otay.id]);
  });
});
