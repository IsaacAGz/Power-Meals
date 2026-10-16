import type { CartItem } from "@/lib/catalog/types";
import type { CartView } from "./view";

export type CartResult = { ok: true; cart: CartView } | { ok: false; message: string };

async function send(path: string, method: "POST" | "PUT", body: unknown): Promise<CartResult> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as CartView & { message?: string };
    if (!response.ok) return { ok: false, message: data.message ?? "No pudimos actualizar tu pedido." };
    return { ok: true, cart: data };
  } catch {
    return { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
  }
}

export const addToCart = (item: CartItem, quantity: number) => send("/api/cart", "POST", { item, quantity });
export const setCartQuantity = (item: CartItem, quantity: number) => send("/api/cart", "PUT", { item, quantity });
export const reorder = (orderId: string) => send("/api/cart/reorder", "POST", { orderId });
