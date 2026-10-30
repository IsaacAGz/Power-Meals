import { afterEach, describe, expect, it, vi } from "vitest";
import { toCartView } from "@/lib/cart/view";
import { resolveLine } from "@/lib/catalog/pricing";
import { formatCents, groupNames } from "@/lib/format";
import { nextKitchenStep, KITCHEN_STATUSES } from "@/lib/kitchen/types";
import {
  isSettledPublicStatus,
  receiptOrigin,
  receiptStepIndex,
  receiptSteps,
  toPublicStatus,
} from "@/lib/orders/public-status";
import { generatePublicOrderRef, isPublicOrderRef, receiptPath } from "@/lib/orders/ref";
import { clientIp, isSameOrigin, readJsonBody } from "@/lib/request";
import { meal, seedCatalog, slots } from "../fixtures/catalog";

describe("public receipt status", () => {
  it("never exposes internal statuses", () => {
    expect(toPublicStatus("pending_payment")).toBe("pending");
    expect(toPublicStatus("ordered_whatsapp")).toBe("whatsapp");
    expect(toPublicStatus("confirmed")).toBe("paid");
    expect(toPublicStatus("cancelled")).toBe("failed");
    expect(toPublicStatus("ready")).toBe("ready");
  });

  it("starts a WhatsApp receipt at the WhatsApp step and a card receipt at pending", () => {
    expect(receiptSteps("whatsapp")[0].status).toBe("whatsapp");
    expect(receiptSteps("card")[0].status).toBe("pending");
    expect(receiptOrigin("paid", "whatsapp")).toBe("whatsapp");
    expect(receiptOrigin("paid", "openpay")).toBe("card");
  });

  it("places each status on its step", () => {
    expect(receiptStepIndex("whatsapp", "whatsapp")).toBe(0);
    expect(receiptStepIndex("ready", "whatsapp")).toBe(3);
    expect(receiptStepIndex("failed", "card")).toBe(0);
  });

  it("treats paid and later as settled", () => {
    expect(["pending", "whatsapp", "failed"].map((s) => isSettledPublicStatus(s as never))).toEqual([false, false, false]);
    expect(["paid", "preparing", "ready", "completed"].map((s) => isSettledPublicStatus(s as never))).toEqual([true, true, true, true]);
  });
});

describe("kitchen steps", () => {
  it("moves one step forward and stops at completed", () => {
    const path = [];
    let status: (typeof KITCHEN_STATUSES)[number] | undefined = "ordered_whatsapp";
    while (status) {
      path.push(status);
      status = nextKitchenStep[status]?.to;
    }
    expect(path).toEqual([...KITCHEN_STATUSES]);
  });
});

describe("order refs", () => {
  it("generates 43-character refs that pass the check", () => {
    const ref = generatePublicOrderRef();
    expect(isPublicOrderRef(ref)).toBe(true);
    expect(isPublicOrderRef("short")).toBe(false);
    expect(isPublicOrderRef(`${ref.slice(0, 42)}!`)).toBe(false);
    expect(receiptPath("a b")).toBe("/pedido/success?order_ref=a%20b");
  });
});

describe("toCartView", () => {
  it("counts meals inside packages and totals the cart", () => {
    const catalog = seedCatalog();
    const lines = [
      resolveLine(catalog, meal(), 2)!,
      resolveLine(catalog, { kind: "package", package: "power-chicken-6-regular", slots: slots(6) }, 1)!,
    ];
    const view = toCartView(lines);
    expect(view.mealCount).toBe(2 + 6);
    expect(view.totalCents).toBe(2 * 13_900 + 64_900);
    expect(view.lines[0].slotNames).toEqual([]);
    expect(view.lines[1].slotNames).toHaveLength(6);
  });
});

describe("format", () => {
  it("formats cents as whole pesos and groups repeats", () => {
    expect(formatCents(13_900)).toBe("$139");
    expect(groupNames(["A", "B", "A"])).toEqual(["2× A", "B"]);
  });
});

describe("request helpers", () => {
  afterEach(() => vi.unstubAllEnvs());

  const request = (headers: Record<string, string>) => new Request("http://localhost:3000/api/x", { method: "POST", headers });

  it("accepts the same host or the site URL as origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://powermeals.mx");
    expect(isSameOrigin(request({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(request({ origin: "https://powermeals.mx", host: "127.0.0.1:3000" }))).toBe(true);
  });

  it("rejects a missing, foreign, or malformed origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://powermeals.mx");
    expect(isSameOrigin(request({ host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(request({ origin: "https://evil.com", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(request({ origin: "not a url", host: "localhost:3000" }))).toBe(false);
  });

  it("prefers X-Real-IP, then the first X-Forwarded-For", () => {
    expect(clientIp(request({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(request({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(request({}))).toBe("unknown");
  });

  it("reads only JSON objects", async () => {
    const json = (body: string, type = "application/json") =>
      new Request("http://x", { method: "POST", headers: { "content-type": type }, body });
    expect(await readJsonBody(json('{"a":1}'))).toEqual({ a: 1 });
    expect(await readJsonBody(json("[1]"))).toBeNull();
    expect(await readJsonBody(json("{bad"))).toBeNull();
    expect(await readJsonBody(json('{"a":1}', "text/plain"))).toBeNull();
  });
});
