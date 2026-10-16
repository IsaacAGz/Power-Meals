import { hashPassword } from "@/lib/auth/password";
import { authError, forbiddenOrigin, isUniqueViolation, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { parseRegistration, safeNextPath } from "@/lib/auth/validation";
import { migrateGuestCartToUser } from "@/lib/cart";
import { getDb, schema } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { rotateSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = await hitRateLimit(`register:ip:${clientIp(request)}`, 5, 60 * 60);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return authError(400, { message: "Solicitud inválida." });

  const { data, errors } = parseRegistration(body);
  if (Object.keys(errors).length > 0) return authError(400, { errors });

  let userId: string;
  try {
    const [user] = await getDb()
      .insert(schema.users)
      .values({
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
      })
      .returning({ id: schema.users.id });
    userId = user.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return authError(409, { errors: { email: "Ya existe una cuenta con este correo. Inicia sesión." } });
    }
    throw error;
  }

  const session = await rotateSession({ userId });
  await migrateGuestCartToUser(session.id, userId);
  return Response.json({ ok: true, redirectTo: safeNextPath(body.next, "/cuenta") } satisfies AuthResponse);
}
