export const cartKey = (sessionId: string) => `cart:session:${sessionId}`;

/** Guest WhatsApp checkout, kept until that same browser session logs in. */
export const whatsAppOrderKey = (sessionId: string) => `whatsapp:order:${sessionId}`;
