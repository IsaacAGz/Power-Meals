import { afterEach, describe, expect, it, vi } from "vitest";
import { pingHeartbeat } from "@/lib/heartbeat";
import { formatLine, redactFields } from "@/lib/log";
import { requestId } from "@/lib/request";
import { scrubUrl, sentryOptions } from "@/lib/sentry-options";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("log lines", () => {
  it("writes one JSON object with ts, level and event first", () => {
    const line = formatLine("error", "order.notify", { orderId: "o-1", attempts: 3 });
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(Object.keys(parsed).slice(0, 3)).toEqual(["ts", "level", "event"]);
    expect(parsed).toMatchObject({ level: "error", event: "order.notify", orderId: "o-1", attempts: 3 });
  });

  it("masks contact details and drops secrets, at any depth", () => {
    expect(
      redactFields({
        customerPhone: "664 123 4567",
        correo: "mariana@example.com",
        deliveryAddress: "Calle 5 #123",
        password: "contraseña",
        customer: { email: "mariana@example.com", phone: "+52 664 123 4567" },
        orderId: "o-1",
      }),
    ).toEqual({
      customerPhone: "***4567",
      correo: "m***@example.com",
      deliveryAddress: "[redacted]",
      password: "[redacted]",
      customer: { email: "m***@example.com", phone: "***4567" },
      orderId: "o-1",
    });
  });

  it("keeps the Openpay verification code readable for the webhook setup", () => {
    expect(JSON.parse(formatLine("info", "openpay.webhook", { type: "verification", verificationCode: "abc123" }))).toMatchObject({
      type: "verification",
      verificationCode: "abc123",
    });
  });

  it("serializes errors without the stack", () => {
    expect(redactFields({ error: new TypeError("boom") })).toEqual({ error: { name: "TypeError", message: "boom" } });
  });
});

describe("requestId", () => {
  it("reads the id Nginx sets", () => {
    expect(requestId(new Request("http://x/", { headers: { "x-request-id": "abc" } }))).toBe("abc");
    expect(requestId(new Request("http://x/"))).toBeUndefined();
  });
});

describe("heartbeat", () => {
  it("does nothing without a URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat(undefined, "success");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings /fail for a failure and the plain URL for success", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("OK"));
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat("https://hc-ping.com/abc/", "fail", '{"alerts":1}');
    await pingHeartbeat("https://hc-ping.com/abc", "success");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://hc-ping.com/abc/fail", "https://hc-ping.com/abc"]);
  });

  it("never throws when the monitor is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(pingHeartbeat("https://hc-ping.com/abc", "success")).resolves.toBeUndefined();
  });
});

describe("sentry options", () => {
  it("is off without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryOptions().enabled).toBe(false);
  });

  it("scrubs receipt refs and email tokens from URLs", () => {
    expect(scrubUrl("https://powermeals.mx/pedido/success?order_ref=abc123&id=tr1")).toBe(
      "https://powermeals.mx/pedido/success?order_ref=[redacted]&id=tr1",
    );
    expect(scrubUrl("/verificar?token=secret")).toBe("/verificar?token=[redacted]");
  });

  it("scrubs breadcrumbs and event URLs", () => {
    const options = sentryOptions();
    expect(options.beforeBreadcrumb({ data: { from: "/pedido", to: "/pedido/success?order_ref=abc" } }).data).toEqual({
      from: "/pedido",
      to: "/pedido/success?order_ref=[redacted]",
    });
    expect(options.beforeSend({ request: { url: "https://powermeals.mx/recuperar/nueva?token=t" } }).request?.url).toBe(
      "https://powermeals.mx/recuperar/nueva?token=[redacted]",
    );
  });
});
