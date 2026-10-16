import { randomBytes } from "node:crypto";

const PUBLIC_ORDER_REF_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 32 random bytes, base64url: unguessable, URL-safe, and within Openpay's 100-char order_id limit. */
export function generatePublicOrderRef(): string {
  return randomBytes(32).toString("base64url");
}

export function isPublicOrderRef(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_ORDER_REF_PATTERN.test(value);
}

export function receiptPath(ref: string, page: "success" | "cancel" = "success") {
  return `/pedido/${page}?order_ref=${encodeURIComponent(ref)}`;
}
