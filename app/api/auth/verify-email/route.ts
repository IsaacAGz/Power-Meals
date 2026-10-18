import { authError, forbiddenOrigin } from "@/lib/auth/responses";
import { consumeEmailVerification, markEmailVerified } from "@/lib/auth/verify-email";
import { migrateGuestCartToUser } from "@/lib/cart";
import { claimWhatsAppOrder } from "@/lib/orders/whatsapp";
import { isSameOrigin, readJsonBody } from "@/lib/request";
import { getSession, rotateSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const body = await readJsonBody(request);
  const token = typeof body?.token === "string" ? body.token : "";
  const userId = await consumeEmailVerification(token);
  if (!userId || !(await markEmailVerified(userId))) {
    return authError(400, { message: "Este enlace no es válido o ya venció." });
  }

  const guestSessionId = (await getSession())?.id;
  const session = await rotateSession({ userId });
  await migrateGuestCartToUser(session.id, userId);
  if (guestSessionId) await claimWhatsAppOrder(guestSessionId, userId);
  return Response.json({ ok: true, redirectTo: "/cuenta" });
}
