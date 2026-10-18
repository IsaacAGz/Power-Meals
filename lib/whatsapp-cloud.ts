import "server-only";

const GRAPH_VERSION = "v21.0";
const SEND_TIMEOUT_MS = 10_000;

/** Token, the sending phone-number id, and the approved template name. Unset means the row stays skipped. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_TEMPLATE_NAME?.trim(),
  );
}

/**
 * Cloud API `to` value. A 10-digit Mexican mobile is sent as 52 plus those digits.
 * A number already stored as 521 plus 10 digits drops the extra 1, which Meta no longer wants.
 */
export function whatsAppRecipient(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  throw new Error("El teléfono no se puede enviar por WhatsApp.");
}

/**
 * One approved utility template. Body variables, in order: first name, order number, receipt link.
 * Language is es_MX. This does not open a wa.me chat.
 */
export async function sendWhatsAppTemplate(input: {
  to: string;
  firstName: string;
  orderNumber: string;
  receiptUrl: string;
}): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const template = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  if (!token || !phoneNumberId || !template) throw new Error("WhatsApp is not configured");

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: template,
        language: { code: "es_MX" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: input.firstName },
              { type: "text", text: input.orderNumber },
              { type: "text", text: input.receiptUrl },
            ],
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new Error(body?.error?.message ?? `WhatsApp respondió ${response.status}`);
}
