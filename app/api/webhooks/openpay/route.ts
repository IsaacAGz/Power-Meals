import { timingSafeEqual } from "node:crypto";
import { getCharge, isOpenpayConfigured, OpenpayError, type Charge } from "@/lib/openpay";
import {
  recordChargeFailed,
  recordChargeSucceeded,
  recordOtherEvent,
  type PaymentOutcome,
  type WebhookEvent,
} from "@/lib/orders/payment";

const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

function log(fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "openpay.webhook", ...fields }));
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Openpay sends the user/password configured on the webhook as HTTP Basic auth. */
function authorized(request: Request): boolean {
  const user = process.env.OPENPAY_WEBHOOK_USER;
  const password = process.env.OPENPAY_WEBHOOK_PASSWORD;
  if (!user || !password) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  return safeEqual(decoded, `${user}:${password}`);
}

/** Only the fields needed for audit; card details and customer data are dropped before storage. */
function redact(body: Record<string, unknown>, transaction: Record<string, unknown>) {
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((key) => key in transaction).map((key) => [key, transaction[key]]));
  return {
    type: body.type,
    event_date: body.event_date,
    transaction: pick(["id", "status", "amount", "currency", "order_id", "method", "operation_date", "error_message", "error_code"]),
  };
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    log({ outcome: "unauthorized" });
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="openpay"' } });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const eventType = typeof body.type === "string" ? body.type : "";

  // Registering the webhook in the Openpay dashboard asks for this code.
  if (eventType === "verification") {
    log({ type: eventType, verificationCode: body.verification_code });
    return Response.json({ ok: true });
  }

  const transaction = (typeof body.transaction === "object" && body.transaction) as Record<string, unknown> | false;
  const transactionId = transaction ? String(transaction.id ?? "") : "";
  if (!eventType || !transaction || !TRANSACTION_ID_PATTERN.test(transactionId)) {
    log({ type: eventType, outcome: "malformed" });
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!isOpenpayConfigured()) {
    log({ type: eventType, transactionId, outcome: "not_configured" });
    return Response.json({ ok: false }, { status: 503 });
  }

  const event: WebhookEvent = { eventType, transactionId, payload: redact(body, transaction) };

  // Webhooks aren't signed, so the payload is only a hint: the charge state comes from the API.
  let charge: Charge | null;
  try {
    charge = await getCharge(transactionId);
  } catch (error) {
    if (error instanceof OpenpayError && error.status === 404) {
      charge = null;
    } else {
      log({ type: eventType, transactionId, outcome: "lookup_failed", message: error instanceof Error ? error.message : String(error) });
      return Response.json({ ok: false }, { status: 502 });
    }
  }

  let outcome: PaymentOutcome;
  if (charge && eventType === "charge.succeeded" && charge.status === "completed") {
    outcome = await recordChargeSucceeded(charge, event);
  } else if (
    charge &&
    (eventType === "charge.failed" || eventType === "charge.cancelled") &&
    (charge.status === "failed" || charge.status === "cancelled")
  ) {
    outcome = await recordChargeFailed(charge, event);
  } else {
    outcome = await recordOtherEvent(charge, event);
  }

  log({ type: eventType, transactionId, orderRef: charge?.orderId, chargeStatus: charge?.status, outcome });
  if (outcome === "amount_mismatch") {
    console.error(JSON.stringify({ event: "openpay.amount_mismatch", transactionId, orderRef: charge?.orderId }));
  }
  return Response.json({ ok: true, outcome });
}
