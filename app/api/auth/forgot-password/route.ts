import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { sendPasswordReset } from "@/lib/auth/reset-password";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { normalizeEmail } from "@/lib/auth/validation";
import { findUserByEmail } from "@/lib/auth/verify-email";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

const SAME_ANSWER = {
  ok: true,
  checkEmail: true,
} as const satisfies AuthResponse;

/** Same answer whether or not the address exists. A missing Turnstile token sends nothing. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const ipLimit = await hitRateLimit(`forgot:ip:${clientIp(request)}`, 5, 60 * 60);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return authError(400, { message: "Solicitud inválida." });

  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return authError(400, { errors: { email: "Escribe un correo válido." } });
  }

  const emailLimit = await hitRateLimit(`forgot:email:${email}`, 3, 60 * 60);
  if (!emailLimit.allowed) return tooManyAttempts(emailLimit.retryAfterSeconds);

  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!(await verifyTurnstile(token, clientIp(request)))) {
    return authError(400, { message: "Confirma que no eres un robot e intenta de nuevo." });
  }

  const user = await findUserByEmail(email);
  if (user) await sendPasswordReset(user.id, user.email);

  return Response.json(SAME_ANSWER);
}
