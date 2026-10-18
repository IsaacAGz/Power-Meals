"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { AuthResponse } from "@/lib/auth/responses";
import { PASSWORD_MIN_LENGTH, type FieldErrors } from "@/lib/auth/validation";
import { buttonPrimary, inputClass, textLink } from "@/lib/ui";
import { FormField } from "../FormField";

export function NewPasswordForm({ token }: { token: string }) {
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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      result = (await response.json()) as AuthResponse;
    } catch {
      result = { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }

    if (result.ok && "redirectTo" in result) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setMessage(result.message ?? "");
    }
    setPending(false);
  }

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <FormField label="Nueva contraseña" error={errors.password} hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
        {(props) => (
          <input
            {...props}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className={inputClass(!!errors.password)}
          />
        )}
      </FormField>
      {message && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
            <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {message}
          </p>
          <Link href="/recuperar" className={textLink}>
            Pedir otro enlace
          </Link>
        </div>
      )}
      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
        {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
        Guardar contraseña
      </button>
    </form>
  );
}
