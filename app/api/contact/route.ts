import { sendContactRequest, isContactConfigured } from "@/lib/contact/send";
import { validateContact, type ContactResponse } from "@/lib/contact/validation";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { errorMessage, log } from "@/lib/log";
import { hitRateLimit } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, readJsonBody, requestId } from "@/lib/request";

const fail = (status: number, body: Omit<Extract<ContactResponse, { ok: false }>, "ok">, headers?: HeadersInit) =>
  Response.json({ ok: false, ...body } satisfies ContactResponse, { status, headers });

const WHATSAPP_FALLBACK = "No pudimos enviar tu solicitud. Escríbenos por WhatsApp y te atendemos.";

/** Partner and catering requests from /contacto, emailed to CONTACT_EMAIL_TO with Reply-To set to the sender. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, { message: "Solicitud no permitida." });

  const ip = clientIp(request);
  const limit = await hitRateLimit(`contact:ip:${ip}`, 5, 60 * 60);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return fail(
      429,
      { message: `Demasiadas solicitudes. Intenta de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` },
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const body = await readJsonBody(request);
  if (!body) return fail(400, { message: "Solicitud inválida." });

  // Honeypot: people never see this field. Answer as if it worked so the bot moves on.
  if (typeof body.sitio === "string" && body.sitio.trim()) return Response.json({ ok: true } satisfies ContactResponse);

  const { data, errors } = validateContact(body);
  if (!data) return fail(400, { errors });

  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!(await verifyTurnstile(token, ip))) {
    return fail(400, { message: "Confirma que no eres un robot e intenta de nuevo." });
  }

  if (!isContactConfigured()) {
    log.warn("contact.unconfigured", { requestId: requestId(request) });
    return fail(503, { message: WHATSAPP_FALLBACK });
  }

  try {
    await sendContactRequest(data);
  } catch (error) {
    log.error("contact.send_failed", { tipo: data.tipo, error: errorMessage(error), requestId: requestId(request) });
    return fail(502, { message: WHATSAPP_FALLBACK });
  }

  log.info("contact.request", { tipo: data.tipo, requestId: requestId(request) });
  return Response.json({ ok: true } satisfies ContactResponse);
}
