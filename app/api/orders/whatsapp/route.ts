import { getCurrentUser } from "@/lib/auth/dal";
import { ensureCartOwner, getPricedCart } from "@/lib/cart";
import { readCheckoutInput, validateCheckout } from "@/lib/orders/checkout-input";
import { createWhatsAppOrder } from "@/lib/orders/create";
import { resolveFulfillment } from "@/lib/orders/fulfillment";
import { rememberWhatsAppOrder } from "@/lib/orders/whatsapp";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

const fail = (status: number, body: Record<string, unknown>) => Response.json({ ok: false, ...body }, { status });

/**
 * Records a WhatsApp checkout. A logged-in customer gets an ordered_whatsapp row immediately.
 * A guest only gets a session snapshot, saved as an order if that same browser later logs in.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, { message: "Solicitud no permitida." });

  const limit = await hitRateLimit(`whatsapp:ip:${clientIp(request)}`, 10, 10 * 60);
  if (!limit.allowed) return fail(429, { message: "Demasiados intentos. Espera unos minutos e intenta de nuevo." });

  const body = await readJsonBody(request);
  if (!body) return fail(400, { message: "Solicitud inválida." });
  const input = readCheckoutInput(body);
  const errors = validateCheckout(input, { requireEmail: false });
  if (Object.keys(errors).length > 0) return fail(400, { errors });

  const owner = await ensureCartOwner();
  const lines = await getPricedCart(owner);
  if (lines.length === 0) return fail(400, { message: "Tu pedido está vacío. Agrega al menos un platillo." });

  const target = await resolveFulfillment(input);
  if (!target) {
    return fail(400, {
      errors: input.metodo === "entrega" ? { zona: "Elige una zona disponible." } : { punto: "Elige un punto disponible." },
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    await rememberWhatsAppOrder(owner.sessionId, {
      input,
      items: lines.map((line) => ({ item: line.item, quantity: line.quantity })),
    });
    return Response.json({ ok: true, saved: false });
  }

  const order = await createWhatsAppOrder({
    userId: user.id,
    customer: { name: input.nombre, email: input.correo || user.email, phone: input.telefono },
    ...target,
    notes: input.notas || null,
    lines,
  });
  console.info(JSON.stringify({ event: "whatsapp.order_created", orderId: order.id, userId: user.id }));
  return Response.json({ ok: true, saved: true });
}
