"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { AuthResponse } from "@/lib/auth/responses";
import { PASSWORD_MIN_LENGTH, type FieldErrors } from "@/lib/auth/validation";
import { buttonPrimary, inputClass } from "@/lib/ui";
import { FormField } from "../FormField";
import { TurnstileField, turnstileSiteKey } from "./TurnstileField";

type Mode = "login" | "register";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const siteKey = turnstileSiteKey();

  async function resend() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as AuthResponse;
      setMessage(
        result.ok
          ? "Si la cuenta aún no está confirmada, enviamos otro enlace."
          : (result.message ?? "No pudimos enviar el correo."),
      );
    } catch {
      setMessage("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
    }
    setPending(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");
    setUnverified(false);

    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get("email") ?? "");
    setEmail(submittedEmail);
    let result: AuthResponse;
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(form),
          next,
          ...(mode === "register" ? { turnstileToken } : {}),
        }),
      });
      result = (await response.json()) as AuthResponse;
    } catch {
      result = { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }

    if (result.ok) {
      if ("checkEmail" in result) {
        setCheckEmail(true);
        setPending(false);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    setErrors(result.errors ?? {});
    setMessage(result.message ?? "");
    setUnverified(result.unverified === true);
    if (mode === "register") {
      setTurnstileToken("");
      setTurnstileKey((key) => key + 1);
    }
    setPending(false);
  }

  if (checkEmail) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed">
          Revisa tu correo. Te enviamos un enlace para confirmar tu cuenta. Vence en 24 horas.
        </p>
        <button type="button" disabled={pending} onClick={resend} className={`${buttonPrimary} w-full`}>
          {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
          Enviar de nuevo
        </button>
        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {mode === "register" && (
        <FormField label="Nombre" error={errors.name}>
          {(props) => (
            <input
              {...props}
              name="name"
              type="text"
              autoComplete="name"
              required
              className={inputClass(!!errors.name)}
              placeholder="Mariana López"
            />
          )}
        </FormField>
      )}
      <FormField label="Correo" error={errors.email}>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className={inputClass(!!errors.email)}
            placeholder="tu@correo.com"
          />
        )}
      </FormField>
      {mode === "register" && (
        <FormField label="Teléfono (opcional)" error={errors.phone} hint="Para avisarte sobre tus entregas.">
          {(props) => (
            <input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass(!!errors.phone)}
              placeholder="664 123 4567"
            />
          )}
        </FormField>
      )}
      <FormField
        label="Contraseña"
        error={errors.password}
        hint={mode === "register" ? `Al menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}
      >
        {(props) => (
          <input
            {...props}
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? PASSWORD_MIN_LENGTH : undefined}
            className={inputClass(!!errors.password)}
          />
        )}
      </FormField>

      {mode === "register" && siteKey && <TurnstileField key={turnstileKey} onToken={setTurnstileToken} />}
      {mode === "register" && !siteKey && (
        <p className="text-sm font-medium text-[#B42318]">No podemos crear la cuenta en este momento. Intenta más tarde.</p>
      )}

      {message && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      {unverified && (
        <button type="button" disabled={pending} onClick={resend} className="text-sm font-semibold text-ink underline">
          Enviar de nuevo
        </button>
      )}

      <button
        type="submit"
        disabled={pending || (mode === "register" && (!siteKey || !turnstileToken))}
        className={`${buttonPrimary} mt-2 w-full`}
      >
        {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
        {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
      </button>
    </form>
  );
}
