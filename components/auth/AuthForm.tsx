"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { AuthResponse } from "@/lib/auth/responses";
import { PASSWORD_MIN_LENGTH, type FieldErrors } from "@/lib/auth/validation";
import { buttonPrimary, inputClass } from "@/lib/ui";
import { FormField } from "../FormField";

type Mode = "login" | "register";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");

    const form = new FormData(event.currentTarget);
    let result: AuthResponse;
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), next }),
      });
      result = (await response.json()) as AuthResponse;
    } catch {
      result = { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }

    if (result.ok) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    setErrors(result.errors ?? {});
    setMessage(result.message ?? "");
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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

      {message && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonPrimary} mt-2 w-full`}>
        {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
        {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
      </button>
    </form>
  );
}
