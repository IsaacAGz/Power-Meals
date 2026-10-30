import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { CartError, changeCartLine, getPricedCart, migrateGuestCartToUser } from "@/lib/cart";
import { cartKey } from "@/lib/cart/keys";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { meal } from "../fixtures/catalog";
import { addToCart, createUser, guest, signIn } from "../helpers/factory";

const quantities = async (owner: Parameters<typeof getPricedCart>[0]) =>
  (await getPricedCart(owner)).map((line) => [line.displayName, line.quantity]);

describe.each([
  ["guest", async () => guest()],
  ["signed-in", async () => signIn((await createUser()).id)],
])("%s cart", (_label, makeOwner) => {
  it("merges the same plate and caps quantity at 20", async () => {
    const owner = await makeOwner();
    await addToCart(owner, meal(), 15);
    await addToCart(owner, { ...meal(), source: "template", template: "pollo-arroz" }, 10);
    expect(await quantities(owner)).toEqual([["Pollo + arroz + veggies · Regular", 20]]);
  });

  it("sets a quantity and removes the line at 0", async () => {
    const owner = await makeOwner();
    await addToCart(owner, meal(), 1);
    await addToCart(owner, meal({ salsa: "verde" }), 1);
    await changeCartLine(owner, meal(), 4, "set");
    expect((await getPricedCart(owner)).map((line) => line.quantity)).toEqual([4, 1]);
    await changeCartLine(owner, meal(), 0, "set");
    expect(await getPricedCart(owner)).toHaveLength(1);
  });

  it("rejects a combination the catalog does not sell and out-of-range quantities", async () => {
    const owner = await makeOwner();
    await expect(changeCartLine(owner, meal({ base: "ensalada", style: "double_carb" }), 1, "add")).rejects.toThrow(CartError);
    await expect(changeCartLine(owner, meal(), 0, "add")).rejects.toThrow(CartError);
    await expect(changeCartLine(owner, meal(), 21, "set")).rejects.toThrow(CartError);
    await expect(changeCartLine(owner, meal(), 1.5, "add")).rejects.toThrow(CartError);
  });

  it("holds at most 30 lines", async () => {
    const owner = await makeOwner();
    const combos = ["pollo", "molida", "basa", "asada", "sirloin", "arrachera", "salmon"].flatMap((protein) =>
      ["pure", "camote", "pasta", "arroz"].flatMap((base) => [meal({ protein, base }), meal({ protein, base, size: "plus" })]),
    );
    for (const item of combos.slice(0, 30)) await addToCart(owner, item);
    await expect(addToCart(owner, combos[30])).rejects.toThrow("demasiados productos");
    await addToCart(owner, combos[0]);
    expect(await getPricedCart(owner)).toHaveLength(30);
  });
});

describe("migrateGuestCartToUser", () => {
  it("moves the guest cart onto the user, merges lines, and deletes the Redis key", async () => {
    const user = await createUser();
    const owner = await signIn(user.id);
    await addToCart(owner, meal(), 5);

    const visitor = { sessionId: "guest-session" };
    await addToCart(visitor, meal(), 18);
    await addToCart(visitor, meal({ protein: "salmon" }), 1);

    await migrateGuestCartToUser(visitor.sessionId, user.id);
    expect((await getPricedCart(owner)).map((line) => line.quantity)).toEqual([20, 1]);
    expect(await getRedis().exists(cartKey(visitor.sessionId))).toBe(0);
  });
});

describe("retired catalog items", () => {
  it("drop out of the priced cart", async () => {
    const owner = await guest();
    await addToCart(owner, meal({ protein: "salmon" }));
    await addToCart(owner, meal());
    await getDb().update(schema.proteins).set({ isActive: false }).where(eq(schema.proteins.slug, "salmon"));
    try {
      expect((await getPricedCart(owner)).map((line) => line.meals[0].protein.slug)).toEqual(["pollo"]);
    } finally {
      await getDb().update(schema.proteins).set({ isActive: true }).where(eq(schema.proteins.slug, "salmon"));
    }
  });
});
