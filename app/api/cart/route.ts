import { CartError, getCart, isCartLineRef, setCartLineQuantity } from "@/lib/cart";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { ensureSession, getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  const cart = session ? await getCart(session.id) : { lines: [], updatedAt: null };
  return Response.json(cart);
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ message: "Solicitud no permitida." }, { status: 403 });

  const limit = await hitRateLimit(`cart:ip:${clientIp(request)}`, 120, 60);
  if (!limit.allowed) {
    return Response.json(
      { message: "Demasiadas solicitudes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJsonBody(request);
  const ref = body && { kind: body.kind, slug: body.slug };
  if (!body || !isCartLineRef(ref) || typeof body.quantity !== "number") {
    return Response.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const session = await ensureSession();
  try {
    return Response.json(await setCartLineQuantity(session.id, ref, body.quantity));
  } catch (error) {
    if (error instanceof CartError) return Response.json({ message: error.message }, { status: 400 });
    throw error;
  }
}
