"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { AuthResponse } from "@/lib/auth/responses";
import { PASSWORD_MIN_LENGTH, type FieldErrors } from "@/lib/auth/validation";
import { buttonPrimary, inputClass, textLink } from "@/lib/ui";
import { TurnstileField, turnstileSiteKey } from "../auth/TurnstileField";
import { FormField } from "../FormField";

type Mode = "register" | "confirm";

async function post(path: string, body: unknown): Promise<AuthResponse> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as AuthResponse;
  } catch {
    return { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
  }
}

/** "Crea una cuenta para guardar este pedido", or a one-click save when already signed in with the order email. */
export function LinkOrderPanel({
  mode,
  orderRef,
  token,
  name,
  email,
  loginHref,
}: {
  mode: Mode;
  orderRef: string;
  token: string;
  name: string;
  email: string;
  loginHref: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const siteKey = turnstileSiteKey();

  async function link() {
    const result = await post("/api/auth/link-order", { orderRef, token });
    if (result.ok && "redirectTo" in result) {
      router.push(result.redirectTo);
      router.refresh();
      return true;
    }
    setMessage(!result.ok ? (result.message ?? "No pudimos guardar el pedido.") : "No pudimos guardar el pedido.");
    return false;
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");

    const form = new FormData(event.currentTarget);
    const registered = await post("/api/auth/register", { ...Object.fromEntries(form), email, turnstileToken });
    if (!registered.ok) {
      setErrors(registered.errors ?? {});
      setMessage(registered.message ?? "");
      setTurnstileToken("");
      setTurnstileKey((key) => key + 1);
      setPending(false);
      return;
    }
    if ("checkEmail" in registered) {
      setCheckEmail(true);
      setPending(false);
      return;
    }
    if (!("redirectTo" in registered) || !(await link())) setPending(false);
  }

  async function handleConfirm() {
    setPending(true);
    setMessage("");
    if (!(await link())) setPending(false);
  }

  const alert = message && (
    <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
      <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );

  return (
    <section aria-labelledby="guardar-pedido" className="rounded-frame border border-line-strong bg-paper p-6 sm:p-8">
      <h2 id="guardar-pedido" className="font-display text-2xl font-extrabold tracking-tight">
        Crea una cuenta para guardar este pedido
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Consulta tus pedidos y repítelos con un clic la próxima vez.
      </p>

      {mode === "confirm" ? (
        <div className="mt-6 flex flex-col gap-4">
          <button type="button" onClick={handleConfirm} disabled={pending} className={`${buttonPrimary} w-fit`}>
            {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
            Guardar en mi cuenta
          </button>
          {alert}
        </div>
      ) : checkEmail ? (
        <p className="mt-6 text-[15px] leading-relaxed">
          Revisa tu correo y abre el enlace para confirmar la cuenta. Cuando inicies sesión, vuelve a este recibo para
          guardar el pedido.
        </p>
      ) : (
        <form method="post" onSubmit={handleRegister} noValidate className="mt-6 flex flex-col gap-5">
          <FormField label="Correo" hint="Es el correo de tu pedido.">
            {(props) => <input {...props} type="email" value={email} readOnly className={`${inputClass(false)} bg-cream`} />}
          </FormField>
          <FormField label="Nombre" error={errors.name}>
            {(props) => (
              <input {...props} name="name" type="text" autoComplete="name" defaultValue={name} className={inputClass(!!errors.name)} />
            )}
          </FormField>
          <FormField label="Contraseña" error={errors.password} hint={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}>
            {(props) => (
              <input
                {...props}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                className={inputClass(!!errors.password)}
              />
            )}
          </FormField>
          {errors.email && <p className="text-sm font-medium text-[#B42318]">{errors.email}</p>}
          {siteKey ? (
            <TurnstileField key={turnstileKey} onToken={setTurnstileToken} />
          ) : (
            <p className="text-sm font-medium text-[#B42318]">No podemos crear la cuenta en este momento. Intenta más tarde.</p>
          )}
          {alert}
          <button type="submit" disabled={pending || !siteKey || !turnstileToken} className={`${buttonPrimary} w-full sm:w-fit`}>
            {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
            Crear cuenta
          </button>
          <p className="text-[15px] text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href={loginHref} className={textLink}>
              Inicia sesión
            </Link>
          </p>
        </form>
      )}
    </section>
  );
}
