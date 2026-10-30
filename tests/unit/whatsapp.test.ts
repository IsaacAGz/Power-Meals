import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOrderMessage, buildWhatsAppUrl, orderTotal } from "@/lib/whatsapp";
import { isWhatsAppConfigured, sendWhatsAppTemplate, whatsAppRecipient } from "@/lib/whatsapp-cloud";

describe("whatsAppRecipient", () => {
  it.each([
    ["664 123 4567", "526641234567"],
    ["+52 664 123 4567", "526641234567"],
    ["+52 1 664 123 4567", "526641234567"],
    ["+1 619 600 1137", "16196001137"],
  ])("%s -> %s", (phone, expected) => {
    expect(whatsAppRecipient(phone)).toBe(expected);
  });

  it("rejects a number that is too short", () => {
    expect(() => whatsAppRecipient("664 123")).toThrow();
  });
});

describe("sendWhatsAppTemplate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configure() {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WHATSAPP_TEMPLATE_NAME", "pedido_pagado");
  }

  it("is off until all three variables are set", () => {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    vi.stubEnv("WHATSAPP_TEMPLATE_NAME", "pedido_pagado");
    expect(isWhatsAppConfigured()).toBe(false);
    configure();
    expect(isWhatsAppConfigured()).toBe(true);
  });

  it("sends the es_MX template with name, order number, and receipt link in order", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsAppTemplate({ to: "526641234567", firstName: "Mariana", orderNumber: "42", receiptUrl: "https://x/r" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(init.headers.Authorization).toBe("Bearer token");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ to: "526641234567", template: { name: "pedido_pagado", language: { code: "es_MX" } } });
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual(["Mariana", "42", "https://x/r"]);
  });

  it("throws Meta's error message", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: { message: "Recipient not in allowed list" } }, { status: 400 })),
    );
    await expect(
      sendWhatsAppTemplate({ to: "1", firstName: "a", orderNumber: "1", receiptUrl: "u" }),
    ).rejects.toThrow("Recipient not in allowed list");
  });
});

describe("buildOrderMessage", () => {
  const order = {
    nombre: "Mariana",
    telefono: "664 123 4567",
    metodo: "recoleccion" as const,
    punto: "Otay",
    lineas: [
      { name: "Pollo + arroz", price: 139, quantity: 2 },
      { name: "POWER Mix", price: 749, quantity: 1 },
    ],
  };

  it("writes the pickup point, each line, and the total", () => {
    const message = buildOrderMessage(order);
    expect(message).toContain("Método: Recolección");
    expect(message).toContain("Punto: Otay");
    expect(message).toMatch(/- 2 x Pollo \+ arroz \(\$139 c\/u\) = \$278/);
    expect(message).toMatch(/Total estimado: \$1,027 MXN/);
    expect(message).not.toContain("Notas:");
  });

  it("adds notes only when present", () => {
    expect(buildOrderMessage({ ...order, notas: "Sin cebolla" })).toContain("Notas: Sin cebolla");
  });

  it("totals lines and encodes the wa.me link", () => {
    expect(orderTotal(order.lineas)).toBe(1027);
    expect(buildWhatsAppUrl("Hola & adiós")).toBe("https://wa.me/16196001137?text=Hola%20%26%20adi%C3%B3s");
  });
});
