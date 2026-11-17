export const CONTACT_KINDS = ["gimnasio", "oficina", "catering"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  gimnasio: "Gimnasio",
  oficina: "Oficina",
  catering: "Catering",
};

export type ContactField = "tipo" | "nombre" | "empresa" | "email" | "telefono" | "personas" | "mensaje";
export type ContactErrors = Partial<Record<ContactField, string>>;

export type ContactRequest = {
  tipo: ContactKind;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  personas: number | null;
  refrigerador: boolean;
  mensaje: string;
};

export const MESSAGE_MAX = 2000;

export type ContactResponse = { ok: true } | { ok: false; message?: string; errors?: ContactErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function isContactKind(value: unknown): value is ContactKind {
  return typeof value === "string" && (CONTACT_KINDS as readonly string[]).includes(value);
}

/** Shared by the form (instant feedback) and the route (the check that counts). */
export function validateContact(body: Record<string, unknown>): { data: ContactRequest | null; errors: ContactErrors } {
  const errors: ContactErrors = {};

  const tipo = body.tipo;
  if (!isContactKind(tipo)) errors.tipo = "Elige el tipo de servicio.";

  const nombre = text(body.nombre);
  if (!nombre) errors.nombre = "Escribe tu nombre.";
  else if (nombre.length > 120) errors.nombre = "El nombre es demasiado largo.";

  const empresa = text(body.empresa);
  if (!empresa) errors.empresa = "Escribe el nombre de tu negocio o evento.";
  else if (empresa.length > 160) errors.empresa = "El nombre es demasiado largo.";

  const email = text(body.email).toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) errors.email = "Escribe un correo válido.";

  const telefono = text(body.telefono);
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.telefono = "Escribe un teléfono de al menos 10 dígitos.";

  let personas: number | null = null;
  const personasRaw = typeof body.personas === "number" ? String(body.personas) : text(body.personas);
  if (personasRaw) {
    const value = Number(personasRaw);
    if (!Number.isInteger(value) || value < 1 || value > 100_000) errors.personas = "Escribe un número entero.";
    else personas = value;
  }

  const mensaje = text(body.mensaje);
  if (mensaje.length > MESSAGE_MAX) errors.mensaje = `Máximo ${MESSAGE_MAX} caracteres.`;

  const refrigerador = body.refrigerador === true && tipo !== "catering";

  if (Object.keys(errors).length > 0 || !isContactKind(tipo)) return { data: null, errors };
  return { data: { tipo, nombre, empresa, email, telefono, personas, refrigerador, mensaje }, errors };
}
