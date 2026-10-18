import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { consumePasswordReset, setPassword } from "@/lib/auth/reset-password";
import { checkPassword } from "@/lib/auth/validation";
import { migrateGuestCartToUser } from "@/lib/cart";
import { getDb, schema } from "@/lib/db";
import { claimWhatsAppOrder } from "@/lib/orders/whatsapp";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { getSession, rotateSession } from "@/lib/session";
import { eq } from "drizzle-orm";

const INVALID = "Este enlace no es válido o ya venció.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = await hitRateLimit(`reset:ip:${clientIp(request)}`, 10, 60 * 60);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return authError(400, { message: "Solicitud inválida." });

  const password = typeof body.password === "string" ? body.password : "";
  const passwordError = checkPassword(password);
  if (passwordError) return authError(400, { errors: { password: passwordError } });

  const token = typeof body.token === "string" ? body.token : "";
  const userId = await consumePasswordReset(token);
  if (!userId || !(await setPassword(userId, password))) {
    return authError(400, { message: INVALID });
  }

  const [user] = await getDb()
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return authError(400, { message: INVALID });

  const guestSessionId = (await getSession())?.id;
  const session = await rotateSession({ userId });
  await migrateGuestCartToUser(session.id, userId);
  if (guestSessionId) await claimWhatsAppOrder(guestSessionId, userId);
  const redirectTo = user.role === "kitchen_staff" ? "/kitchen/dashboard" : "/cuenta";
  return Response.json({ ok: true, redirectTo } satisfies AuthResponse);
}
