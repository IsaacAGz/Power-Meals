import "server-only";
import { eq } from "drizzle-orm";
import { whatsAppOrderKey } from "@/lib/cart/keys";
import { getCatalog } from "@/lib/catalog";
import { parseCartItem, resolveLine, MAX_LINE_QUANTITY, type ResolvedLine } from "@/lib/catalog/pricing";
import type { CartItem } from "@/lib/catalog/types";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { sessionTtlSeconds } from "@/lib/session";
import { readCheckoutInput, validateCheckout, type CheckoutInput } from "./checkout-input";
import { createWhatsAppOrder } from "./create";
import { resolveFulfillment } from "./fulfillment";

type Snapshot = { input: CheckoutInput; items: { item: CartItem; quantity: number }[] };

function parseSnapshot(raw: string): Snapshot | undefined {
  try {
    const data = JSON.parse(raw) as { input?: unknown; items?: unknown };
    if (typeof data.input !== "object" || data.input === null || !Array.isArray(data.items) || data.items.length === 0) {
      return;
    }
    const input = readCheckoutInput(data.input as Record<string, unknown>);
    if (Object.keys(validateCheckout(input, { requireEmail: false })).length > 0) return;
    const items: Snapshot["items"] = [];
    for (const entry of data.items) {
      if (typeof entry !== "object" || entry === null) return;
      const record = entry as { item?: unknown; quantity?: unknown };
      const item = parseCartItem(record.item);
      const quantity = Number(record.quantity);
      if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return;
      items.push({ item, quantity });
    }
    return { input, items };
  } catch {
    return;
  }
}

/** A guest click stores the order here. Nothing is written to PostgreSQL until this session logs in. */
export async function rememberWhatsAppOrder(sessionId: string, snapshot: Snapshot) {
  await getRedis().set(whatsAppOrderKey(sessionId), JSON.stringify(snapshot), "EX", sessionTtlSeconds());
}

async function priceSnapshot(snapshot: Snapshot): Promise<ResolvedLine[] | undefined> {
  const catalog = await getCatalog();
  const lines: ResolvedLine[] = [];
  for (const entry of snapshot.items) {
    const line = resolveLine(catalog, entry.item, entry.quantity);
    if (!line) return;
    lines.push(line);
  }
  return lines;
}

/**
 * Turns the Redis snapshot for this browser session into an ordered_whatsapp row.
 * A line that is no longer in the catalog drops the snapshot and leaves the cart.
 */
export async function claimWhatsAppOrder(sessionId: string, userId: string) {
  const redis = getRedis();
  const key = whatsAppOrderKey(sessionId);
  const raw = await redis.get(key);
  if (!raw) return false;

  const snapshot = parseSnapshot(raw);
  const lines = snapshot ? await priceSnapshot(snapshot) : undefined;
  const target = snapshot && lines ? await resolveFulfillment(snapshot.input) : undefined;
  if (!snapshot || !lines || !target) {
    await redis.del(key);
    return false;
  }

  const [user] = await getDb()
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return false;

  const claimed = await redis.getdel(key);
  if (!claimed) return false;

  try {
    const order = await createWhatsAppOrder({
      userId,
      customer: {
        name: snapshot.input.nombre,
        email: snapshot.input.correo || user.email,
        phone: snapshot.input.telefono,
      },
      ...target,
      notes: snapshot.input.notas || null,
      lines,
    });
    console.info(JSON.stringify({ event: "whatsapp.order_claimed", orderId: order.id, userId }));
    return true;
  } catch (error) {
    await redis.set(key, claimed, "EX", sessionTtlSeconds());
    throw error;
  }
}
