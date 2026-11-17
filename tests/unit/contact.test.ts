import { describe, expect, it } from "vitest";
import { validateContact } from "@/lib/contact/validation";

const valid = {
  tipo: "oficina",
  nombre: " Luis ",
  empresa: "Río Cowork",
  email: "LUIS@example.com",
  telefono: "+52 664 123 4567",
  personas: "40",
  refrigerador: true,
  mensaje: "",
};

describe("validateContact", () => {
  it("trims and normalizes a valid request", () => {
    const { data, errors } = validateContact(valid);
    expect(errors).toEqual({});
    expect(data).toEqual({
      tipo: "oficina",
      nombre: "Luis",
      empresa: "Río Cowork",
      email: "luis@example.com",
      telefono: "+52 664 123 4567",
      personas: 40,
      refrigerador: true,
      mensaje: "",
    });
  });

  it("treats people as optional", () => {
    expect(validateContact({ ...valid, personas: "" }).data?.personas).toBeNull();
    expect(validateContact({ ...valid, personas: "2.5" }).errors.personas).toBeDefined();
  });

  it("never asks for a fridge on catering", () => {
    expect(validateContact({ ...valid, tipo: "catering" }).data?.refrigerador).toBe(false);
  });

  it("reports every missing required field", () => {
    const { data, errors } = validateContact({});
    expect(data).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["email", "empresa", "nombre", "telefono", "tipo"]);
  });

  it("caps the message length", () => {
    expect(validateContact({ ...valid, mensaje: "a".repeat(2001) }).errors.mensaje).toBeDefined();
  });
});
