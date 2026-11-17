import { afterEach, describe, expect, it } from "vitest";
import { POST as contact } from "@/app/api/contact/route";
import { json, post } from "../helpers/factory";
import { emailFailures, sentEmails } from "../helpers/outbox";

const request = (overrides: Record<string, unknown> = {}) => ({
  tipo: "gimnasio",
  nombre: "Ana Ruiz",
  empresa: "Hierro Gym",
  email: "Ana@Example.com",
  telefono: "664 123 4567",
  personas: "250",
  refrigerador: true,
  mensaje: "Abrimos de 5 a 23 h.",
  turnstileToken: "pass",
  ...overrides,
});

const inbox = process.env.CONTACT_EMAIL_TO;

describe("POST /api/contact", () => {
  afterEach(() => {
    process.env.CONTACT_EMAIL_TO = inbox;
  });

  it("emails the request to the contact inbox with Reply-To set to the sender", async () => {
    const response = await contact(post("/api/contact", request()));
    expect(response.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toMatchObject({
      to: "partners@powermeals.test",
      replyTo: "ana@example.com",
      subject: "Solicitud de gimnasio: Hierro Gym",
    });
    expect(sentEmails[0].text).toContain("Socios: 250");
    expect(sentEmails[0].text).toContain("Necesita refrigerador: Sí");
  });

  it("rejects invalid fields without sending", async () => {
    const response = await contact(post("/api/contact", request({ tipo: "otro", email: "nope", telefono: "123" })));
    expect(response.status).toBe(400);
    const body = await json<{ errors: Record<string, string> }>(response);
    expect(Object.keys(body.errors).sort()).toEqual(["email", "telefono", "tipo"]);
    expect(sentEmails).toEqual([]);
  });

  it("requires a solved Turnstile challenge", async () => {
    const response = await contact(post("/api/contact", request({ turnstileToken: "" })));
    expect(response.status).toBe(400);
    expect(sentEmails).toEqual([]);
  });

  it("answers a filled honeypot as success without sending", async () => {
    const response = await contact(post("/api/contact", request({ sitio: "http://spam.example" })));
    expect(response.status).toBe(200);
    expect(sentEmails).toEqual([]);
  });

  it("returns 503 when the inbox is not configured", async () => {
    process.env.CONTACT_EMAIL_TO = "";
    const response = await contact(post("/api/contact", request()));
    expect(response.status).toBe(503);
    expect(sentEmails).toEqual([]);
  });

  it("returns 502 when SES fails", async () => {
    emailFailures.next = 1;
    const response = await contact(post("/api/contact", request()));
    expect(response.status).toBe(502);
  });

  it("rate limits by IP", async () => {
    for (let i = 0; i < 5; i += 1) await contact(post("/api/contact", request({ turnstileToken: "" })));
    const response = await contact(post("/api/contact", request()));
    expect(response.status).toBe(429);
  });

  it("rejects cross-origin requests", async () => {
    const response = await contact(post("/api/contact", request(), { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
  });
});
