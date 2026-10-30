import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { whatsAppOrderKey } from "@/lib/cart/keys";
import { getDb, schema } from "@/lib/db";
import { readCheckoutInput } from "@/lib/orders/checkout-input";
import { claimWhatsAppOrder, rememberWhatsAppOrder } from "@/lib/orders/whatsapp";
import { getRedis } from "@/lib/redis";
import { meal } from "../fixtures/catalog";
import { createUser, pickupBody } from "../helpers/factory";

const userOrders = (userId: string) => getDb().select().from(schema.orders).where(eq(schema.orders.userId, userId));

describe("guest WhatsApp order", () => {
  it("is claimed by a login on the same session and uses the account email", async () => {
    const user = await createUser({ email: "cuenta@example.com" });
    await rememberWhatsAppOrder("browser-a", {
      input: readCheckoutInput(pickupBody({ punto: "zona-rio" })),
      items: [{ item: meal(), quantity: 3 }],
    });

    expect(await claimWhatsAppOrder("browser-a", user.id)).toBe(true);
    const orders = await userOrders(user.id);
    expect(orders).toMatchObject([{ status: "ordered_whatsapp", customerEmail: "cuenta@example.com", totalCents: 3 * 13_900 }]);
    expect(await getRedis().exists(whatsAppOrderKey("browser-a"))).toBe(0);
    expect(await claimWhatsAppOrder("browser-a", user.id)).toBe(false);
  });

  it("keeps the email typed at checkout over the account email", async () => {
    const user = await createUser();
    await rememberWhatsAppOrder("browser-a", {
      input: readCheckoutInput(pickupBody({ correo: "otro@example.com" })),
      items: [{ item: meal(), quantity: 1 }],
    });
    await claimWhatsAppOrder("browser-a", user.id);
    expect((await userOrders(user.id))[0].customerEmail).toBe("otro@example.com");
  });

  it("is not visible from another session", async () => {
    const user = await createUser();
    await rememberWhatsAppOrder("browser-a", { input: readCheckoutInput(pickupBody()), items: [{ item: meal(), quantity: 1 }] });
    expect(await claimWhatsAppOrder("browser-b", user.id)).toBe(false);
    expect(await userOrders(user.id)).toEqual([]);
  });

  it("is dropped when a line no longer resolves", async () => {
    const user = await createUser();
    await rememberWhatsAppOrder("browser-a", {
      input: readCheckoutInput(pickupBody()),
      items: [{ item: meal({ protein: "retired" }), quantity: 1 }],
    });
    expect(await claimWhatsAppOrder("browser-a", user.id)).toBe(false);
    expect(await getRedis().exists(whatsAppOrderKey("browser-a"))).toBe(0);
    expect(await userOrders(user.id)).toEqual([]);
  });

  it("is dropped when the snapshot asks for delivery", async () => {
    const user = await createUser();
    await getRedis().set(
      whatsAppOrderKey("browser-a"),
      JSON.stringify({ input: pickupBody({ metodo: "entrega", zona: "otay", direccion: "Calle 1" }), items: [{ item: meal(), quantity: 1 }] }),
    );
    expect(await claimWhatsAppOrder("browser-a", user.id)).toBe(false);
    expect(await userOrders(user.id)).toEqual([]);
  });
});
