"use client";

import { useState, type FormEvent } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { AuthResponse } from "@/lib/auth/responses";
import { buttonPrimary, inputClass } from "@/lib/ui";
import { FormField } from "../FormField";
import { TurnstileField, turnstileSiteKey } from "./TurnstileField";

export function ResetRequestForm() {
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const siteKey = turnstileSiteKey();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setEmailError("");

    const form = new FormData(event.currentTarget);
    let result: AuthResponse;
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), turnstileToken }),
      });
      result = (await response.json()) as AuthResponse;
    } catch {
      result = { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }

    if (result.ok && "checkEmail" in result) {
      setSent(true);
      setPending(false);
      return;
    }
    if (!result.ok) {
      setEmailError(result.errors?.email ?? "");
      setMessage(result.message ?? "");
    }
    setTurnstileToken("");
    setTurnstileKey((key) => key + 1);
    setPending(false);
  }

  if (sent) {
    return (
      <p className="text-[15px] leading-relaxed">
        Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja.
        Vence en 1 hora.
      </p>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField label="Correo" error={emailError}>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className={inputClass(!!emailError)}
            placeholder="tu@correo.com"
          />
        )}
      </FormField>
      {siteKey ? (
        <TurnstileField key={turnstileKey} onToken={setTurnstileToken} />
      ) : (
        <p className="text-sm font-medium text-[#B42318]">No podemos enviar el enlace en este momento. Intenta más tarde.</p>
      )}
      {message && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      <button type="submit" disabled={pending || !siteKey || !turnstileToken} className={`${buttonPrimary} w-full`}>
        {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
        Enviar enlace
      </button>
    </form>
  );
}
