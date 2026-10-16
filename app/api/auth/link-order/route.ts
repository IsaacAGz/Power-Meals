import { getCurrentUser } from "@/lib/auth/dal";
import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { attachOrderToUser, checkLinkToken } from "@/lib/orders/link";
import { isPublicOrderRef } from "@/lib/orders/ref";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

/** "Crea una cuenta para guardar este pedido": attaches a paid guest order to the signed-in user. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = await hitRateLimit(`link-order:ip:${clientIp(request)}`, 10, 15 * 60);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  const user = await getCurrentUser();
  if (!user) return authError(401, { message: "Inicia sesión para guardar el pedido." });

  const body = await readJsonBody(request);
  const ref = body?.orderRef;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!isPublicOrderRef(ref) || !token) return authError(400, { message: "Solicitud inválida." });

  if (!(await checkLinkToken(ref, token))) {
    return authError(410, { message: "Este enlace expiró. Recarga la página del pedido e intenta de nuevo." });
  }
  if (!(await attachOrderToUser(ref, user))) {
    return authError(409, { message: "No pudimos guardar este pedido en tu cuenta. Usa el mismo correo del pedido." });
  }
  return Response.json({ ok: true, redirectTo: "/historial" } satisfies AuthResponse);
}
