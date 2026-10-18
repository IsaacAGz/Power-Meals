import { authError, forbiddenOrigin, tooManyAttempts, type AuthResponse } from "@/lib/auth/responses";
import { normalizeEmail } from "@/lib/auth/validation";
import { findUserByEmail, isOrderEmailConfigured, sendVerificationEmail } from "@/lib/auth/verify-email";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";

const SAME_ANSWER = {
  ok: true,
  checkEmail: true,
} as const satisfies AuthResponse;

/** Same answer whether or not the address exists. Only an unverified account receives another link. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const ipLimit = await hitRateLimit(`verify-resend:ip:${clientIp(request)}`, 10, 60 * 60);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  const body = await readJsonBody(request);
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  if (!email) return authError(400, { message: "Escribe un correo válido." });

  const emailLimit = await hitRateLimit(`verify-resend:email:${email}`, 3, 60 * 60);
  if (!emailLimit.allowed) return tooManyAttempts(emailLimit.retryAfterSeconds);

  if (isOrderEmailConfigured()) {
    const user = await findUserByEmail(email);
    if (user && !user.emailVerifiedAt) {
      try {
        await sendVerificationEmail(user.id, user.email);
      } catch {
        // Same answer as a missing address. The person can ask again.
      }
    }
  }

  return Response.json(SAME_ANSWER);
}
