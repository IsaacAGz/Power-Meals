import { homeFor } from "@/lib/auth/dal";
import { verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { parseLogin, safeNextPath } from "@/lib/auth/validation";
import { findUserByEmail } from "@/lib/auth/verify-email";
import { migrateGuestCartToUser } from "@/lib/cart";
import { claimWhatsAppOrder } from "@/lib/orders/whatsapp";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { getSession, rotateSession } from "@/lib/session";

const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const ipLimit = await hitRateLimit(`login:ip:${clientIp(request)}`, 20, WINDOW_SECONDS);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return authError(400, { message: "Solicitud inválida." });

  const { data, errors } = parseLogin(body);
  if (Object.keys(errors).length > 0) return authError(400, { errors });

  const emailLimit = await hitRateLimit(`login:email:${data.email}`, 5, WINDOW_SECONDS);
  if (!emailLimit.allowed) return tooManyAttempts(emailLimit.retryAfterSeconds);

  const user = await findUserByEmail(data.email);

  const valid = user ? await verifyPassword(user.passwordHash, data.password) : await verifyAgainstDummy(data.password);
  if (!user || !valid) return authError(401, { message: "Correo o contraseña incorrectos." });
  if (!user.emailVerifiedAt) {
    return authError(403, {
      message: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja o pide otro enlace.",
      unverified: true,
    });
  }

  const guestSessionId = (await getSession())?.id;
  const session = await rotateSession({ userId: user.id });
  await migrateGuestCartToUser(session.id, user.id);
  if (guestSessionId) await claimWhatsAppOrder(guestSessionId, user.id);
  return Response.json({ ok: true, redirectTo: safeNextPath(body.next, homeFor(user)) } satisfies AuthResponse);
}
