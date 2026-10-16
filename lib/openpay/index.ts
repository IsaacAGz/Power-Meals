import "server-only";
import { requireEnv } from "@/lib/env";

const SANDBOX_API = "https://sandbox-api.openpay.mx";
const PRODUCTION_API = "https://api.openpay.mx";
const TIMEOUT_MS = 15_000;

export class OpenpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: number,
  ) {
    super(message);
  }
}

/** Openpay transaction statuses, lowercased as the API returns them. */
export type ChargeStatus = "completed" | "in_progress" | "charge_pending" | "failed" | "cancelled" | "refunded" | string;

export type Charge = {
  id: string;
  status: ChargeStatus;
  amount: number;
  currency: string;
  orderId: string | null;
  errorMessage: string | null;
  paymentUrl: string | null;
};

export function isOpenpayConfigured() {
  return Boolean(process.env.OPENPAY_MERCHANT_ID && process.env.OPENPAY_PRIVATE_KEY);
}

function config() {
  const sandbox = process.env.OPENPAY_SANDBOX_MODE !== "false";
  return {
    baseUrl: `${sandbox ? SANDBOX_API : PRODUCTION_API}/v1/${encodeURIComponent(requireEnv("OPENPAY_MERCHANT_ID"))}`,
    auth: `Basic ${Buffer.from(`${requireEnv("OPENPAY_PRIVATE_KEY")}:`).toString("base64")}`,
  };
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const { baseUrl, auth } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const description = typeof data.description === "string" ? data.description : response.statusText;
    throw new OpenpayError(description, response.status, typeof data.error_code === "number" ? data.error_code : undefined);
  }
  return data;
}

function toCharge(data: Record<string, unknown>): Charge {
  const paymentMethod = data.payment_method as { type?: unknown; url?: unknown } | undefined;
  return {
    id: String(data.id ?? ""),
    status: String(data.status ?? "").toLowerCase(),
    amount: Number(data.amount),
    currency: String(data.currency ?? ""),
    orderId: typeof data.order_id === "string" ? data.order_id : null,
    errorMessage: typeof data.error_message === "string" ? data.error_message : null,
    paymentUrl: paymentMethod?.type === "redirect" && typeof paymentMethod.url === "string" ? paymentMethod.url : null,
  };
}

export type RedirectChargeInput = {
  amountCents: number;
  description: string;
  orderRef: string;
  redirectUrl: string;
  customer: { name: string; email: string; phone: string };
};

/**
 * Hosted card form (no card data touches this server). Openpay sends the customer back to
 * redirectUrl with ?id=<transaction id> whatever the outcome; payment truth comes from the webhook.
 */
export async function createRedirectCharge(input: RedirectChargeInput): Promise<Charge & { paymentUrl: string }> {
  const [name, ...rest] = input.customer.name.trim().split(/\s+/);
  const charge = toCharge(
    await call("POST", "/charges", {
      method: "card",
      amount: Number((input.amountCents / 100).toFixed(2)),
      currency: "MXN",
      description: input.description.slice(0, 250),
      order_id: input.orderRef,
      customer: {
        name,
        last_name: rest.join(" ") || undefined,
        email: input.customer.email,
        phone_number: input.customer.phone.replace(/\D/g, "").slice(-10),
      },
      confirm: false,
      send_email: false,
      redirect_url: input.redirectUrl,
    }),
  );
  if (!charge.paymentUrl) throw new OpenpayError("Openpay no devolvió la URL de pago.", 502);
  return { ...charge, paymentUrl: charge.paymentUrl };
}

export async function getCharge(chargeId: string): Promise<Charge> {
  return toCharge(await call("GET", `/charges/${encodeURIComponent(chargeId)}`));
}
