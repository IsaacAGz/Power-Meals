import { GetAccountCommand, GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { isOrderEmailConfigured, sendOrderEmail } from "../lib/email";
import { paidReceiptMessage } from "../lib/orders/notify";
import { receiptPath } from "../lib/orders/ref";

const usage = `Usage: npm run email:test -- <to-address>

Reports the SES account and from-address status, then sends the paid-order email (fake order #0) to one
address without touching the database. In the SES sandbox the recipient must be a verified identity too.
Needs ORDER_EMAIL_FROM, AWS_REGION and AWS credentials (an AWS profile locally, the instance role on EC2).`;

/** Read-only checks. The EC2 role only has ses:SendEmail, so an AccessDenied here is reported, not fatal. */
async function report(client: SESv2Client, from: string) {
  const domain = from.slice(from.lastIndexOf("@") + 1);
  try {
    const account = await client.send(new GetAccountCommand({}));
    const quota = account.SendQuota;
    console.info(
      account.ProductionAccessEnabled
        ? `account: production access (${quota?.Max24HourSend ?? "?"} per day, ${quota?.MaxSendRate ?? "?"} per second)`
        : "account: SES SANDBOX. Only verified recipients receive mail until production access is granted.",
    );
    if (account.EnforcementStatus && account.EnforcementStatus !== "HEALTHY") {
      console.warn(`account: enforcement status ${account.EnforcementStatus}`);
    }
  } catch (error) {
    console.warn(`account: could not read (${errorName(error)}); fine on EC2, where the role only sends`);
  }
  for (const identity of new Set([from, domain])) {
    try {
      const result = await client.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
      console.info(
        `identity ${identity}: ${result.VerifiedForSendingStatus ? "verified" : "NOT verified"}, DKIM ${result.DkimAttributes?.Status ?? "n/a"}`,
      );
    } catch (error) {
      if (errorName(error) !== "NotFoundException") console.warn(`identity ${identity}: could not read (${errorName(error)})`);
    }
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : String(error);
}

/** Turns the usual setup mistakes into the next step to take. */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = errorName(error);
  if (name === "MessageRejected" && /not verified/i.test(message)) {
    return `${message}\nIn the sandbox both sender and recipient must be verified identities in ${process.env.AWS_REGION}. Verify the recipient in the SES console or wait for production access.`;
  }
  if (name === "AccessDeniedException" || name === "AccessDenied") {
    return `${message}\nThe credentials lack ses:SendEmail on this identity (docs/ec2-setup.md, "Instance role").`;
  }
  if (name === "CredentialsProviderError" || /credential/i.test(message)) {
    return `${message}\nNo AWS credentials found. Locally: aws configure (or AWS_PROFILE=...); on EC2 the instance role provides them.`;
  }
  return `${name}: ${message}`;
}

async function main() {
  const [to] = process.argv.slice(2);
  if (!to || !to.includes("@")) throw new Error(usage);
  if (!isOrderEmailConfigured()) throw new Error("Set ORDER_EMAIL_FROM to an address on the verified SES domain.");
  if (!process.env.AWS_REGION) throw new Error("Set AWS_REGION to the region where the SES identity is verified.");

  const from = process.env.ORDER_EMAIL_FROM!.trim();
  console.info(`from ${from} via SES in ${process.env.AWS_REGION}`);
  await report(new SESv2Client({ region: process.env.AWS_REGION }), from);

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const message = paidReceiptMessage(0, `${origin}${receiptPath("prueba")}`);
  try {
    await sendOrderEmail({ to, subject: `[Prueba] ${message.subject}`, text: message.text });
  } catch (error) {
    throw new Error(explain(error));
  }
  console.info(`sent "${message.subject}" to ${to}. Check the inbox and the spam folder.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
