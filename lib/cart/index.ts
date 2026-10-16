import "server-only";
import { getRedis } from "@/lib/redis";
import { sessionTtlSeconds } from "@/lib/session";
import { cartKey } from "./keys";

export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 50;

// Phase 2 adds builder, template, and package-slot kinds alongside "dish".
export type CartLineRef = { kind: "dish"; slug: string };
export type CartLine = CartLineRef & { quantity: number };
export type Cart = { lines: CartLine[]; updatedAt: number | null };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CartError extends Error {}

const emptyCart = (): Cart => ({ lines: [], updatedAt: null });
const sameLine = (a: CartLineRef, b: CartLineRef) => a.kind === b.kind && a.slug === b.slug;

export function isCartLineRef(value: unknown): value is CartLineRef {
  if (typeof value !== "object" || value === null) return false;
  const { kind, slug } = value as Record<string, unknown>;
  return kind === "dish" && typeof slug === "string" && slug.length <= 80 && SLUG_PATTERN.test(slug);
}

export async function getCart(sessionId: string): Promise<Cart> {
  const raw = await getRedis().get(cartKey(sessionId));
  if (!raw) return emptyCart();
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    return emptyCart();
  }
}

async function saveCart(sessionId: string, cart: Cart) {
  const redis = getRedis();
  if (cart.lines.length === 0) {
    await redis.del(cartKey(sessionId));
    return;
  }
  await redis.set(cartKey(sessionId), JSON.stringify(cart), "EX", sessionTtlSeconds());
}

/** Sets the quantity for one line; 0 removes it. Prices are never stored here and are resolved at checkout. */
export async function setCartLineQuantity(sessionId: string, ref: CartLineRef, quantity: number): Promise<Cart> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) {
    throw new CartError(`La cantidad debe estar entre 0 y ${MAX_LINE_QUANTITY}.`);
  }

  const cart = await getCart(sessionId);
  const others = cart.lines.filter((line) => !sameLine(line, ref));
  const existing = cart.lines.find((line) => sameLine(line, ref));

  if (quantity === 0) {
    cart.lines = others;
  } else if (existing) {
    existing.quantity = quantity;
  } else {
    if (cart.lines.length >= MAX_CART_LINES) throw new CartError("Tu carrito ya tiene demasiados productos.");
    cart.lines.push({ kind: ref.kind, slug: ref.slug, quantity });
  }

  cart.updatedAt = Date.now();
  await saveCart(sessionId, cart);
  return cart.lines.length === 0 ? emptyCart() : cart;
}

export async function clearCart(sessionId: string) {
  await getRedis().del(cartKey(sessionId));
}
