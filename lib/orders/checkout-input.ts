// Shared by the checkout form (client) and POST /api/checkout (server), so both report the same errors.

export type CheckoutField = "nombre" | "telefono" | "correo" | "zona" | "direccion" | "punto";
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export type CheckoutInput = {
  nombre: string;
  telefono: string;
  correo: string;
  metodo: "entrega" | "recoleccion";
  zona: string;
  direccion: string;
  punto: string;
  notas: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function readCheckoutInput(body: Record<string, unknown>): CheckoutInput {
  return {
    nombre: text(body.nombre, 80),
    telefono: text(body.telefono, 30),
    correo: text(body.correo, 254).toLowerCase(),
    metodo: body.metodo === "recoleccion" ? "recoleccion" : "entrega",
    zona: text(body.zona, 80),
    direccion: text(body.direccion, 200),
    punto: text(body.punto, 80),
    notas: text(body.notas, 500),
  };
}

/** Card payments need an email for the Openpay receipt and account link; WhatsApp orders don't. */
export function validateCheckout(input: CheckoutInput, { requireEmail }: { requireEmail: boolean }): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (input.nombre.length < 2) errors.nombre = "Escribe tu nombre.";
  const digits = input.telefono.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.telefono = "Escribe un teléfono de al menos 10 dígitos.";
  if (requireEmail || input.correo) {
    if (!EMAIL_PATTERN.test(input.correo)) errors.correo = "Escribe un correo válido para tu recibo.";
  }
  if (input.metodo === "entrega") {
    errors.zona = "La entrega a domicilio no está disponible por ahora.";
  } else if (!input.punto) {
    errors.punto = "Elige un punto de recolección.";
  }
  return errors;
}
