import { hashPassword } from "@/lib/auth/password";
import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { findUserByEmail, isOrderEmailConfigured, sendVerificationEmail } from "@/lib/auth/verify-email";
import { parseRegistration } from "@/lib/auth/validation";
import { getDb, schema } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { eq } from "drizzle-orm";

const CHECK_EMAIL = {
  ok: true,
  checkEmail: true,
} as const satisfies AuthResponse;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = await hitRateLimit(`register:ip:${clientIp(request)}`, 5, 60 * 60);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  if (!isOrderEmailConfigured()) {
    return authError(503, { message: "No podemos crear la cuenta en este momento. Intenta más tarde." });
  }

  const body = await readJsonBody(request);
  if (!body) return authError(400, { message: "Solicitud inválida." });

  const { data, errors } = parseRegistration(body);
  if (Object.keys(errors).length > 0) return authError(400, { errors });

  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return authError(400, { message: "Confirma que no eres un robot e intenta de nuevo." });
  }

  const existing = await findUserByEmail(data.email);
  if (existing?.emailVerifiedAt) {
    return authError(409, { errors: { email: "Ya existe una cuenta con este correo. Inicia sesión." } });
  }
  if (existing) {
    const resend = await hitRateLimit(`verify-resend:email:${data.email}`, 3, 60 * 60);
    if (!resend.allowed) return tooManyAttempts(resend.retryAfterSeconds);
    try {
      await sendVerificationEmail(existing.id, existing.email);
    } catch {
      return authError(502, { message: "No pudimos enviar el correo de confirmación. Intenta de nuevo." });
    }
    return Response.json(CHECK_EMAIL);
  }

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
    const raced = await findUserByEmail(data.email);
    if (raced?.emailVerifiedAt) {
      return authError(409, { errors: { email: "Ya existe una cuenta con este correo. Inicia sesión." } });
    }
    if (raced) {
      await sendVerificationEmail(raced.id, raced.email);
      return Response.json(CHECK_EMAIL);
    }
    throw error;
  }

  try {
    await sendVerificationEmail(userId, data.email);
  } catch {
    await getDb().delete(schema.users).where(eq(schema.users.id, userId));
    return authError(502, { message: "No pudimos enviar el correo de confirmación. Intenta de nuevo." });
  }

  return Response.json(CHECK_EMAIL);
}
