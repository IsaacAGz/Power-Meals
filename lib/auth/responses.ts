import type { FieldErrors } from "./validation";

export type AuthResponse =
  | { ok: true; redirectTo: string }
  | { ok: true; checkEmail: true }
  | { ok: false; message?: string; errors?: FieldErrors; unverified?: boolean };

export function authError(status: number, body: Omit<Extract<AuthResponse, { ok: false }>, "ok">) {
  return Response.json({ ok: false, ...body } satisfies AuthResponse, { status });
}

export function forbiddenOrigin() {
  return authError(403, { message: "Solicitud no permitida." });
}

export function tooManyAttempts(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return Response.json(
    {
      ok: false,
      message: `Demasiados intentos. Intenta de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
    } satisfies AuthResponse,
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) => (value as { code?: unknown } | null)?.code;
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}
