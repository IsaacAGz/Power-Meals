import { describe, expect, it } from "vitest";
import { checkPassword, parseLogin, parseRegistration, safeNextPath } from "@/lib/auth/validation";
import { readCheckoutInput, validateCheckout } from "@/lib/orders/checkout-input";

const pickup = { nombre: "Mariana López", telefono: "664 123 4567", metodo: "recoleccion", punto: "otay" };

describe("readCheckoutInput", () => {
  it("trims, lowercases the email, and caps lengths", () => {
    const input = readCheckoutInput({ ...pickup, correo: "  Mariana@Example.COM ", notas: "x".repeat(600) });
    expect(input.correo).toBe("mariana@example.com");
    expect(input.notas).toHaveLength(500);
  });

  it("treats anything but recoleccion as entrega", () => {
    expect(readCheckoutInput({ metodo: "drone" }).metodo).toBe("entrega");
    expect(readCheckoutInput({ metodo: "recoleccion" }).metodo).toBe("recoleccion");
  });

  it("ignores non-string fields", () => {
    expect(readCheckoutInput({ nombre: 42, telefono: ["664"] })).toMatchObject({ nombre: "", telefono: "" });
  });
});

describe("validateCheckout", () => {
  const validate = (body: Record<string, unknown>, requireEmail = false) =>
    validateCheckout(readCheckoutInput(body), { requireEmail });

  it("accepts a pickup order without an email for WhatsApp", () => {
    expect(validate(pickup)).toEqual({});
  });

  it("requires an email for card checkout", () => {
    expect(validate(pickup, true)).toHaveProperty("correo");
    expect(validate({ ...pickup, correo: "a@b.mx" }, true)).toEqual({});
  });

  it("checks an optional email when one is given", () => {
    expect(validate({ ...pickup, correo: "not-an-email" })).toHaveProperty("correo");
  });

  it("rejects delivery while it is off", () => {
    expect(validate({ ...pickup, metodo: "entrega", zona: "otay", direccion: "Calle 1" })).toEqual({
      zona: "La entrega a domicilio no está disponible por ahora.",
    });
  });

  it("requires a pickup point, a name, and a 10-15 digit phone", () => {
    expect(validate({ ...pickup, punto: "" })).toHaveProperty("punto");
    expect(validate({ ...pickup, nombre: "M" })).toHaveProperty("nombre");
    expect(validate({ ...pickup, telefono: "664 123" })).toHaveProperty("telefono");
    expect(validate({ ...pickup, telefono: "1".repeat(16) })).toHaveProperty("telefono");
    expect(validate({ ...pickup, telefono: "+1 (619) 600-1137" })).toEqual({});
  });
});

describe("parseRegistration", () => {
  const valid = { name: "Mariana", email: " Mariana@Example.com ", password: "0123456789" };

  it("normalizes the email and makes an empty phone null", () => {
    expect(parseRegistration(valid)).toEqual({
      data: { name: "Mariana", email: "mariana@example.com", password: "0123456789", phone: null },
      errors: {},
    });
  });

  it("requires a 10-character password", () => {
    expect(parseRegistration({ ...valid, password: "123456789" }).errors).toHaveProperty("password");
  });

  it("rejects a short phone only when one is given", () => {
    expect(parseRegistration({ ...valid, phone: "664" }).errors).toHaveProperty("phone");
    expect(parseRegistration({ ...valid, phone: "664 123 4567" }).errors).toEqual({});
  });

  it("rejects a bad name and email", () => {
    const { errors } = parseRegistration({ ...valid, name: "M", email: "nope" });
    expect(Object.keys(errors).sort()).toEqual(["email", "name"]);
  });
});

describe("parseLogin and checkPassword", () => {
  it("does not apply the length rule to login, only to new passwords", () => {
    expect(parseLogin({ email: "a@b.mx", password: "short" }).errors).toEqual({});
    expect(checkPassword("short")).toBeDefined();
    expect(checkPassword("x".repeat(129))).toBeDefined();
    expect(checkPassword("x".repeat(10))).toBeUndefined();
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/historial", "/historial"],
    ["/pedido?x=1", "/pedido?x=1"],
    ["//evil.com", "/cuenta"],
    ["/\\evil.com", "/cuenta"],
    ["https://evil.com", "/cuenta"],
    [undefined, "/cuenta"],
  ])("%s -> %s", (value, expected) => {
    expect(safeNextPath(value, "/cuenta")).toBe(expected);
  });
});
