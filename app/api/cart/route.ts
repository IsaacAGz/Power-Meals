import { CartError, changeCartLine, currentCartOwner, ensureCartOwner, getPricedCart } from "@/lib/cart";
import { toCartView } from "@/lib/cart/view";
import { parseCartItem } from "@/lib/catalog/pricing";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

export async function GET() {
  return Response.json(toCartView(await getPricedCart(await currentCartOwner())));
}

async function mutate(request: Request, mode: "set" | "add") {
  if (!isSameOrigin(request)) return Response.json({ message: "Solicitud no permitida." }, { status: 403 });

  const limit = await hitRateLimit(`cart:ip:${clientIp(request)}`, 120, 60);
  if (!limit.allowed) {
    return Response.json(
      { message: "Demasiadas solicitudes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJsonBody(request);
  const item = parseCartItem(body?.item);
  if (!body || !item || typeof body.quantity !== "number") {
    return Response.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const owner = await ensureCartOwner();
  try {
    await changeCartLine(owner, item, body.quantity, mode);
  } catch (error) {
    if (error instanceof CartError) return Response.json({ message: error.message }, { status: 400 });
    throw error;
  }
  return Response.json(toCartView(await getPricedCart(owner)));
}

/** Adds to the line's quantity (merging identical compositions). */
export async function POST(request: Request) {
  return mutate(request, "add");
}

/** Sets the line's quantity; 0 removes it. */
export async function PUT(request: Request) {
  return mutate(request, "set");
}
