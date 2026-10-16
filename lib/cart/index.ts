import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { getCatalog } from "@/lib/catalog";
import { lineKey, MAX_CART_LINES, MAX_LINE_QUANTITY, parseCartItem, resolveLine, type ResolvedLine } from "@/lib/catalog/pricing";
import type { CartItem } from "@/lib/catalog/types";
import { getDb, schema, type Database } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { ensureSession, getSession, sessionTtlSeconds, type Session } from "@/lib/session";
import { cartKey } from "./keys";

export { MAX_LINE_QUANTITY } from "@/lib/catalog/pricing";

/** Guests keep their cart in Redis under the session; signed-in users keep it in cart_line_items. */
export type CartOwner = { sessionId: string; userId?: string };
type StoredLine = { key: string; item: CartItem; quantity: number };
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export class CartError extends Error {}

const ownerOf = (session: Session): CartOwner => ({ sessionId: session.id, userId: session.data.userId });

export async function currentCartOwner(): Promise<CartOwner | null> {
  const session = await getSession();
  return session ? ownerOf(session) : null;
}

/** Server Functions and Route Handlers only (may set the session cookie). */
export async function ensureCartOwner(): Promise<CartOwner> {
  return ownerOf(await ensureSession());
}

function parseStored(lines: { item: unknown; quantity: unknown }[]): StoredLine[] {
  const parsed: StoredLine[] = [];
  for (const line of lines) {
    const item = parseCartItem(line.item);
    const quantity = Number(line.quantity);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) continue;
    parsed.push({ key: lineKey(item), item, quantity });
  }
  return parsed;
}

async function readGuestLines(sessionId: string): Promise<StoredLine[]> {
  const raw = await getRedis().get(cartKey(sessionId));
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { lines?: unknown };
    return Array.isArray(data.lines) ? parseStored(data.lines) : [];
  } catch {
    return [];
  }
}

async function writeGuestLines(sessionId: string, lines: StoredLine[]) {
  const redis = getRedis();
  if (lines.length === 0) {
    await redis.del(cartKey(sessionId));
    return;
  }
  const payload = { lines: lines.map(({ item, quantity }) => ({ item, quantity })), updatedAt: Date.now() };
  await redis.set(cartKey(sessionId), JSON.stringify(payload), "EX", sessionTtlSeconds());
}

async function readUserLines(userId: string): Promise<StoredLine[]> {
  const rows = await getDb()
    .select({ item: schema.cartLineItems.item, quantity: schema.cartLineItems.quantity })
    .from(schema.cartLineItems)
    .where(eq(schema.cartLineItems.userId, userId))
    .orderBy(schema.cartLineItems.createdAt);
  return parseStored(rows);
}

export async function readCartLines(owner: CartOwner): Promise<StoredLine[]> {
  return owner.userId ? readUserLines(owner.userId) : readGuestLines(owner.sessionId);
}

/** Lines priced against the live catalog. Lines whose products were retired are dropped. */
export async function getPricedCart(owner: CartOwner | null): Promise<ResolvedLine[]> {
  if (!owner) return [];
  const [catalog, lines] = await Promise.all([getCatalog(), readCartLines(owner)]);
  return lines.flatMap((line) => resolveLine(catalog, line.item, line.quantity) ?? []);
}

const sourceOf = (item: CartItem) => (item.kind === "package" ? "package" : item.source);

async function upsertUserLine(db: DbOrTx, userId: string, item: CartItem, quantity: number, mode: "set" | "add") {
  const key = lineKey(item);
  if (mode === "set" && quantity === 0) {
    await db
      .delete(schema.cartLineItems)
      .where(and(eq(schema.cartLineItems.userId, userId), eq(schema.cartLineItems.lineKey, key)));
    return;
  }

  const [existing] = await db
    .select({ quantity: schema.cartLineItems.quantity })
    .from(schema.cartLineItems)
    .where(and(eq(schema.cartLineItems.userId, userId), eq(schema.cartLineItems.lineKey, key)));
  if (!existing) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(schema.cartLineItems)
      .where(eq(schema.cartLineItems.userId, userId));
    if (value >= MAX_CART_LINES) throw new CartError("Tu carrito ya tiene demasiados productos.");
  }

  await db
    .insert(schema.cartLineItems)
    .values({ userId, lineKey: key, source: sourceOf(item), item, quantity })
    .onConflictDoUpdate({
      target: [schema.cartLineItems.userId, schema.cartLineItems.lineKey],
      set: {
        item: sql`excluded.item`,
        quantity:
          mode === "add"
            ? sql`least(${MAX_LINE_QUANTITY}, ${schema.cartLineItems.quantity} + excluded.quantity)`
            : sql`excluded.quantity`,
        updatedAt: new Date(),
      },
    });
}

function applyToGuest(lines: StoredLine[], item: CartItem, quantity: number, mode: "set" | "add"): StoredLine[] {
  const key = lineKey(item);
  const existing = lines.find((line) => line.key === key);
  const next = Math.min(MAX_LINE_QUANTITY, mode === "add" ? (existing?.quantity ?? 0) + quantity : quantity);
  if (next === 0) return lines.filter((line) => line.key !== key);
  if (existing) return lines.map((line) => (line.key === key ? { ...line, item, quantity: next } : line));
  if (lines.length >= MAX_CART_LINES) throw new CartError("Tu carrito ya tiene demasiados productos.");
  return [...lines, { key, item, quantity: next }];
}

export async function changeCartLine(owner: CartOwner, item: CartItem, quantity: number, mode: "set" | "add") {
  const min = mode === "add" ? 1 : 0;
  if (!Number.isInteger(quantity) || quantity < min || quantity > MAX_LINE_QUANTITY) {
    throw new CartError(`La cantidad debe estar entre ${min} y ${MAX_LINE_QUANTITY}.`);
  }
  if (quantity > 0 && !resolveLine(await getCatalog(), item, 1)) {
    throw new CartError("Esta combinación no está disponible.");
  }

  if (owner.userId) {
    await upsertUserLine(getDb(), owner.userId, item, quantity, mode);
  } else {
    await writeGuestLines(owner.sessionId, applyToGuest(await readGuestLines(owner.sessionId), item, quantity, mode));
  }
}

export async function addCartItems(owner: CartOwner, items: { item: CartItem; quantity: number }[]) {
  if (owner.userId) {
    const userId = owner.userId;
    await getDb().transaction(async (tx) => {
      for (const { item, quantity } of items) await upsertUserLine(tx, userId, item, quantity, "add");
    });
    return;
  }
  let lines = await readGuestLines(owner.sessionId);
  for (const { item, quantity } of items) lines = applyToGuest(lines, item, quantity, "add");
  await writeGuestLines(owner.sessionId, lines);
}

/**
 * Moves the guest cart into cart_line_items after login, register, or account link, merging identical
 * lines, then deletes the Redis key.
 */
export async function migrateGuestCartToUser(sessionId: string, userId: string) {
  const lines = await readGuestLines(sessionId);
  if (lines.length > 0) {
    await getDb().transaction(async (tx) => {
      for (const line of lines) {
        try {
          await upsertUserLine(tx, userId, line.item, line.quantity, "add");
        } catch (error) {
          if (!(error instanceof CartError)) throw error;
        }
      }
    });
  }
  await getRedis().del(cartKey(sessionId));
}

export async function clearUserCart(db: DbOrTx, userId: string) {
  await db.delete(schema.cartLineItems).where(eq(schema.cartLineItems.userId, userId));
}

export async function clearGuestCart(sessionId: string) {
  await getRedis().del(cartKey(sessionId));
}
