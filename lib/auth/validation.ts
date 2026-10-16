export type AuthField = "name" | "email" | "password" | "phone";
export type FieldErrors = Partial<Record<AuthField, string>>;

export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function normalizeEmail(value: unknown): string {
  return text(value).trim().toLowerCase();
}

function checkEmail(email: string): string | undefined {
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return "Escribe un correo válido.";
}

export function parseLogin(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const password = text(body.password);
  const errors: FieldErrors = {};
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  if (!password || password.length > PASSWORD_MAX_LENGTH) errors.password = "Escribe tu contraseña.";
  return { data: { email, password }, errors };
}

export function parseRegistration(body: Record<string, unknown>) {
  const name = text(body.name).trim();
  const email = normalizeEmail(body.email);
  const password = text(body.password);
  const phoneRaw = text(body.phone).trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");

  const errors: FieldErrors = {};
  if (name.length < 2 || name.length > 80) errors.name = "Escribe tu nombre.";
  const emailError = checkEmail(email);
  if (emailError) errors.email = emailError;
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Usa máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (phoneRaw && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    errors.phone = "Escribe un teléfono de al menos 10 dígitos.";
  }

  return { data: { name, email, password, phone: phoneRaw || null }, errors };
}

/** Only same-site paths, so `?next=` can't become an open redirect. */
export function safeNextPath(value: unknown, fallback: string): string {
  const path = text(value);
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}
