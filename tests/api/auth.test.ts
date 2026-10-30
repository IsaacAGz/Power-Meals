import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { getPricedCart } from "@/lib/cart";
import { getDb, schema } from "@/lib/db";
import { readCheckoutInput } from "@/lib/orders/checkout-input";
import { rememberWhatsAppOrder } from "@/lib/orders/whatsapp";
import { getRedis } from "@/lib/redis";
import { meal } from "../fixtures/catalog";
import { cookieJar, sessionCookie } from "../helpers/cookies";
import { addToCart, createUser, guest, json, PASSWORD, pickupBody, post } from "../helpers/factory";
import { emailFailures, lastLinkTo, sentEmails, tokenFrom } from "../helpers/outbox";

const registration = (overrides: Record<string, unknown> = {}) => ({
  name: "Mariana López",
  email: "Mariana@Example.com",
  password: PASSWORD,
  phone: "664 123 4567",
  turnstileToken: "pass",
  ...overrides,
});

const userByEmail = async (email: string) =>
  (await getDb().select().from(schema.users).where(eq(schema.users.email, email)))[0];

const sessionUserId = async () => {
  const id = sessionCookie();
  const raw = id ? await getRedis().get(`session:${id}`) : null;
  return raw ? (JSON.parse(raw) as { userId?: string }).userId : undefined;
};

describe("POST /api/auth/register", () => {
  it("creates an unverified customer, emails a link, and does not sign in", async () => {
    const response = await register(post("/api/auth/register", registration()));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, checkEmail: true });

    const user = await userByEmail("mariana@example.com");
    expect(user).toMatchObject({ role: "customer", emailVerifiedAt: null });
    expect(sentEmails).toHaveLength(1);
    expect(lastLinkTo("mariana@example.com").pathname).toBe("/verificar");
    expect(sessionCookie()).toBeUndefined();
  });

  it("rejects a cross-site request", async () => {
    const response = await register(post("/api/auth/register", registration(), { origin: "https://evil.com" }));
    expect(response.status).toBe(403);
  });

  it("creates nothing without a solved Turnstile challenge", async () => {
    for (const token of [undefined, "", "fail"]) {
      const response = await register(post("/api/auth/register", registration({ turnstileToken: token })));
      expect(response.status).toBe(400);
    }
    expect(await userByEmail("mariana@example.com")).toBeUndefined();
    expect(sentEmails).toEqual([]);
  });

  it("does not keep the user when the confirmation email fails", async () => {
    emailFailures.next = 1;
    const response = await register(post("/api/auth/register", registration()));
    expect(response.status).toBe(502);
    expect(await userByEmail("mariana@example.com")).toBeUndefined();
  });

  it("refuses to register while SES is unset", async () => {
    const previous = process.env.ORDER_EMAIL_FROM;
    process.env.ORDER_EMAIL_FROM = "";
    try {
      expect((await register(post("/api/auth/register", registration()))).status).toBe(503);
      expect(await userByEmail("mariana@example.com")).toBeUndefined();
    } finally {
      process.env.ORDER_EMAIL_FROM = previous;
    }
  });

  it("answers 409 for a verified email and resends for an unverified one", async () => {
    await createUser({ email: "verificada@example.com" });
    expect((await register(post("/api/auth/register", registration({ email: "verificada@example.com" })))).status).toBe(409);

    await createUser({ email: "pendiente@example.com", verified: false });
    const response = await register(post("/api/auth/register", registration({ email: "pendiente@example.com" })));
    expect(await json(response)).toEqual({ ok: true, checkEmail: true });
    expect(sentEmails.map((email) => email.to)).toEqual(["pendiente@example.com"]);
  });

  it("returns field errors for invalid input", async () => {
    const response = await register(post("/api/auth/register", registration({ password: "corta" })));
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ errors: { password: expect.any(String) } });
  });

  it("limits registrations to 5 per IP per hour", async () => {
    for (let i = 0; i < 5; i += 1) {
      await register(post("/api/auth/register", registration({ email: `persona${i}@example.com` })));
    }
    const response = await register(post("/api/auth/register", registration({ email: "otra@example.com" })));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/auth/verify-email", () => {
  it("confirms the email once and signs the person in", async () => {
    await register(post("/api/auth/register", registration()));
    const token = tokenFrom(lastLinkTo("mariana@example.com"));

    const response = await verifyEmail(post("/api/auth/verify-email", { token }));
    expect(await json(response)).toEqual({ ok: true, redirectTo: "/cuenta" });
    const user = await userByEmail("mariana@example.com");
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await sessionUserId()).toBe(user.id);

    cookieJar.clear();
    expect((await verifyEmail(post("/api/auth/verify-email", { token }))).status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    expect((await verifyEmail(post("/api/auth/verify-email", { token: "nope" }))).status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("refuses the right password until the email is confirmed", async () => {
    await createUser({ email: "pendiente@example.com", verified: false });
    const response = await login(post("/api/auth/login", { email: "pendiente@example.com", password: PASSWORD }));
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ unverified: true });
    expect(sessionCookie()).toBeUndefined();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await createUser({ email: "cliente@example.com" });
    const wrong = await login(post("/api/auth/login", { email: "cliente@example.com", password: "incorrecta-123" }));
    const unknown = await login(post("/api/auth/login", { email: "nadie@example.com", password: PASSWORD }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await json(wrong)).toEqual(await json(unknown));
  });

  it("signs in on a new session id, moves the guest cart, and claims the guest WhatsApp order", async () => {
    const user = await createUser({ email: "cliente@example.com" });
    const visitor = await guest();
    await addToCart(visitor, meal(), 2);
    await rememberWhatsAppOrder(visitor.sessionId, {
      input: readCheckoutInput(pickupBody()),
      items: [{ item: meal({ protein: "asada" }), quantity: 1 }],
    });

    const response = await login(post("/api/auth/login", { email: "Cliente@Example.com", password: PASSWORD, next: "/historial" }));
    expect(await json(response)).toEqual({ ok: true, redirectTo: "/historial" });
    expect(sessionCookie()).not.toBe(visitor.sessionId);
    expect(await sessionUserId()).toBe(user.id);
    expect(await getRedis().exists(`session:${visitor.sessionId}`)).toBe(0);

    const orders = await getDb().select().from(schema.orders).where(eq(schema.orders.userId, user.id));
    expect(orders).toHaveLength(1);
    // The claimed order clears the cart it was placed from.
    expect(await getPricedCart({ sessionId: sessionCookie()!, userId: user.id })).toEqual([]);
  });

  it("sends kitchen staff to the dashboard and ignores an off-site next", async () => {
    await createUser({ email: "cocina@powermeals.test", staffAt: "otay" });
    const response = await login(post("/api/auth/login", { email: "cocina@powermeals.test", password: PASSWORD, next: "//evil.com" }));
    expect(await json(response)).toEqual({ ok: true, redirectTo: "/kitchen/dashboard" });
  });

  it("locks an email after 5 attempts in 15 minutes", async () => {
    await createUser({ email: "cliente@example.com" });
    for (let i = 0; i < 5; i += 1) {
      await login(post("/api/auth/login", { email: "cliente@example.com", password: "incorrecta-123" }));
    }
    const response = await login(post("/api/auth/login", { email: "cliente@example.com", password: PASSWORD }));
    expect(response.status).toBe(429);
  });
});

describe("password reset", () => {
  it("answers the same for a known and unknown address, and only emails the known one", async () => {
    await createUser({ email: "cliente@example.com" });
    const known = await forgotPassword(post("/api/auth/forgot-password", { email: "cliente@example.com", turnstileToken: "pass" }));
    const unknown = await forgotPassword(post("/api/auth/forgot-password", { email: "nadie@example.com", turnstileToken: "pass" }));
    expect(await json(known)).toEqual(await json(unknown));
    expect(sentEmails.map((email) => email.to)).toEqual(["cliente@example.com"]);
    expect(lastLinkTo("cliente@example.com").pathname).toBe("/recuperar/nueva");
  });

  it("sends nothing without Turnstile", async () => {
    await createUser({ email: "cliente@example.com" });
    const response = await forgotPassword(post("/api/auth/forgot-password", { email: "cliente@example.com" }));
    expect(response.status).toBe(400);
    expect(sentEmails).toEqual([]);
  });

  it("sets the new password once, signs in, and retires the old password", async () => {
    const user = await createUser({ email: "cliente@example.com", verified: false });
    await forgotPassword(post("/api/auth/forgot-password", { email: "cliente@example.com", turnstileToken: "pass" }));
    const token = tokenFrom(lastLinkTo("cliente@example.com"));

    const response = await resetPassword(post("/api/auth/reset-password", { token, password: "nueva-contraseña-1" }));
    expect(await json(response)).toEqual({ ok: true, redirectTo: "/cuenta" });
    expect(await sessionUserId()).toBe(user.id);
    expect((await userByEmail("cliente@example.com")).emailVerifiedAt).toBeInstanceOf(Date);

    cookieJar.clear();
    expect((await resetPassword(post("/api/auth/reset-password", { token, password: "otra-contraseña-2" }))).status).toBe(400);
    expect((await login(post("/api/auth/login", { email: "cliente@example.com", password: PASSWORD }))).status).toBe(401);
    expect((await login(post("/api/auth/login", { email: "cliente@example.com", password: "nueva-contraseña-1" }))).status).toBe(200);
  });

  it("checks the new password's length before using the token", async () => {
    await createUser({ email: "cliente@example.com" });
    await forgotPassword(post("/api/auth/forgot-password", { email: "cliente@example.com", turnstileToken: "pass" }));
    const token = tokenFrom(lastLinkTo("cliente@example.com"));
    expect((await resetPassword(post("/api/auth/reset-password", { token, password: "corta" }))).status).toBe(400);
    expect((await resetPassword(post("/api/auth/reset-password", { token, password: "nueva-contraseña-1" }))).status).toBe(200);
  });
});
