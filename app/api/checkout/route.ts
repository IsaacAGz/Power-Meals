import { getCurrentUser } from "@/lib/auth/dal";
import { currentCartOwner, getPricedCart } from "@/lib/cart";
import { createRedirectCharge, isOpenpayConfigured, OpenpayError } from "@/lib/openpay";
import { readCheckoutInput, validateCheckout } from "@/lib/orders/checkout-input";
import { abandonOrder, attachChargeToOrder, createPendingOrder } from "@/lib/orders/create";
import { resolveFulfillment } from "@/lib/orders/fulfillment";
import { rememberCheckoutCart } from "@/lib/orders/payment";
import { receiptPath } from "@/lib/orders/ref";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody, siteUrl } from "@/lib/request";

const fail = (status: number, body: Record<string, unknown>) => Response.json({ ok: false, ...body }, { status });

/** Creates a pending order from the server-side cart and returns the Openpay hosted payment URL. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, { message: "Solicitud no permitida." });

  const limit = await hitRateLimit(`checkout:ip:${clientIp(request)}`, 10, 10 * 60);
  if (!limit.allowed) return fail(429, { message: "Demasiados intentos. Espera unos minutos e intenta de nuevo." });

  if (!isOpenpayConfigured()) {
    return fail(503, { message: "El pago en línea no está disponible por ahora. Envía tu pedido por WhatsApp." });
  }

  const body = await readJsonBody(request);
  if (!body) return fail(400, { message: "Solicitud inválida." });
  const input = readCheckoutInput(body);
  const errors = validateCheckout(input, { requireEmail: true });
  if (Object.keys(errors).length > 0) return fail(400, { errors });

  const owner = await currentCartOwner();
  const lines = await getPricedCart(owner);
  if (!owner || lines.length === 0) return fail(400, { message: "Tu pedido está vacío. Agrega al menos un platillo." });

  const target = await resolveFulfillment(input);
  if (!target) {
    return fail(400, {
      errors: input.metodo === "entrega" ? { zona: "Elige una zona disponible." } : { punto: "Elige un punto disponible." },
    });
  }

  const user = await getCurrentUser();
  const order = await createPendingOrder({
    userId: user?.id ?? null,
    customer: { name: input.nombre, email: input.correo, phone: input.telefono },
    ...target,
    notes: input.notas || null,
    lines,
  });

  try {
    const charge = await createRedirectCharge({
      amountCents: order.totalCents,
      description: `Power Meals pedido #${order.orderNumber}`,
      orderRef: order.publicOrderRef,
      redirectUrl: `${siteUrl()}${receiptPath(order.publicOrderRef)}`,
      customer: { name: input.nombre, email: input.correo, phone: input.telefono },
    });
    await attachChargeToOrder(order.id, charge.id);
    if (!owner.userId) await rememberCheckoutCart(order.publicOrderRef, owner.sessionId);

    console.info(JSON.stringify({ event: "checkout.charge_created", orderId: order.id, chargeId: charge.id }));
    return Response.json({ ok: true, redirectUrl: charge.paymentUrl });
  } catch (error) {
    await abandonOrder(order.id);
    console.error(
      JSON.stringify({
        event: "checkout.charge_failed",
        orderId: order.id,
        status: error instanceof OpenpayError ? error.status : undefined,
        errorCode: error instanceof OpenpayError ? error.errorCode : undefined,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return fail(502, { message: "No pudimos iniciar el pago con Openpay. Intenta de nuevo o envía tu pedido por WhatsApp." });
  }
}
