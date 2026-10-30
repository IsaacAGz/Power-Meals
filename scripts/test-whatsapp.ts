import { receiptPath } from "../lib/orders/ref";
import { isWhatsAppConfigured, sendWhatsAppTemplate, whatsAppRecipient } from "../lib/whatsapp-cloud";

const usage = `Usage: npm run whatsapp:test -- <phone> [first name]

Sends the paid-order template to one number without touching the database, to check the token,
template, and number format during setup. On the Meta test number the phone must be on its allowed list.`;

/** Sends a sample paid-order template with a fake order number and receipt link. */
async function main() {
  const [phone, firstName = "Prueba"] = process.argv.slice(2);
  if (!phone) throw new Error(usage);
  if (!isWhatsAppConfigured()) throw new Error("Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_TEMPLATE_NAME.");

  const to = whatsAppRecipient(phone);
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const receiptUrl = `${origin}${receiptPath("prueba")}`;
  await sendWhatsAppTemplate({ to, firstName, orderNumber: "0", receiptUrl });
  console.info(`Template ${process.env.WHATSAPP_TEMPLATE_NAME} sent to ${to} (receipt link ${receiptUrl})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
