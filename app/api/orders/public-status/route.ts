import type { NextRequest } from "next/server";
import { getPublicStatus } from "@/lib/orders/public-receipt";
import { isPublicOrderRef } from "@/lib/orders/ref";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

const noStore = { "Cache-Control": "no-store" };

/** Polled by the receipt until the order is delivered or cancelled. Sessionless; status and origin only. */
export async function GET(request: NextRequest) {
  const limit = await hitRateLimit(`order-status:ip:${clientIp(request)}`, 60, 60);
  if (!limit.allowed) {
    return Response.json(
      { message: "Demasiadas solicitudes." },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const ref = request.nextUrl.searchParams.get("order_ref");
  const status = isPublicOrderRef(ref) ? await getPublicStatus(ref) : null;
  if (!status) return Response.json({ message: "Pedido no encontrado." }, { status: 404, headers: noStore });
  return Response.json(status, { headers: noStore });
}
