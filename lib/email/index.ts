import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const SEND_TIMEOUT_MS = 10_000;

let client: SESv2Client | undefined;

export function isOrderEmailConfigured(): boolean {
  return Boolean(process.env.ORDER_EMAIL_FROM?.trim());
}

/** Credentials come from the default AWS chain, the same one SQS uses. */
function getClient(): SESv2Client {
  client ??= new SESv2Client({ region: process.env.AWS_REGION, maxAttempts: 3 });
  return client;
}

export async function sendOrderEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  const from = process.env.ORDER_EMAIL_FROM?.trim();
  if (!from) throw new Error("ORDER_EMAIL_FROM is not set");
  await getClient().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Body: { Text: { Data: input.text, Charset: "UTF-8" } },
        },
      },
    }),
    { abortSignal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
}
