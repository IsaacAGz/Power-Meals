"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import {
  CONTACT_KIND_LABEL,
  CONTACT_KINDS,
  MESSAGE_MAX,
  validateContact,
  type ContactErrors,
  type ContactKind,
  type ContactResponse,
} from "@/lib/contact/validation";
import { buttonPrimary, inputBase, inputClass } from "@/lib/ui";
import { FormField } from "./FormField";
import { TurnstileField, turnstileSiteKey } from "./auth/TurnstileField";
import { ChoiceGroup } from "./order/ChoiceGroup";

const PEOPLE_LABEL: Record<ContactKind, string> = {
  gimnasio: "Número de socios",
  oficina: "Número de colaboradores",
  catering: "Número de invitados",
};

const KIND_NOTE: Record<ContactKind, string> = {
  gimnasio: "Punto de recogida",
  oficina: "Entrega privada",
  catering: "Eventos",
};

export function ContactForm({ initialKind }: { initialKind: ContactKind | "" }) {
  const [tipo, setTipo] = useState<ContactKind | "">(initialKind);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const siteKey = turnstileSiteKey();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      tipo,
      nombre: form.get("nombre"),
      empresa: form.get("empresa"),
      email: form.get("email"),
      telefono: form.get("telefono"),
      personas: form.get("personas"),
      refrigerador: form.get("refrigerador") === "on",
      mensaje: form.get("mensaje"),
      sitio: form.get("sitio"),
    };

    const local = validateContact(payload);
    setErrors(local.errors);
    if (!local.data) return;

    setPending(true);
    let result: ContactResponse;
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, turnstileToken }),
      });
      result = (await response.json()) as ContactResponse;
    } catch {
      result = { ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." };
    }
    setPending(false);

    if (result.ok) {
      setSent(true);
      return;
    }
    setErrors(result.errors ?? {});
    setMessage(result.message ?? "");
    setTurnstileToken("");
    setTurnstileKey((key) => key + 1);
  }

  if (sent) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-frame border border-line-strong bg-paper p-6">
        <CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-power" aria-hidden />
        <div>
          <p className="font-display text-2xl font-extrabold tracking-tight">Gracias, recibimos tu solicitud.</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Te contactamos en 1 a 2 días hábiles.</p>
        </div>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div>
        <ChoiceGroup
          legend="¿Qué te interesa?"
          options={CONTACT_KINDS.map((kind) => ({ value: kind, label: CONTACT_KIND_LABEL[kind], note: KIND_NOTE[kind] }))}
          value={tipo}
          onChange={setTipo}
          className="grid-cols-1 sm:grid-cols-3"
        />
        {errors.tipo && <p className="mt-2 text-[13px] font-medium text-danger">{errors.tipo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Nombre" error={errors.nombre}>
          {(props) => (
            <input {...props} name="nombre" autoComplete="name" required className={inputClass(!!errors.nombre)} />
          )}
        </FormField>
        <FormField label={tipo === "catering" ? "Empresa o evento" : "Nombre del negocio"} error={errors.empresa}>
          {(props) => (
            <input
              {...props}
              name="empresa"
              autoComplete="organization"
              required
              className={inputClass(!!errors.empresa)}
            />
          )}
        </FormField>
        <FormField label="Correo" error={errors.email}>
          {(props) => (
            <input
              {...props}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="tu@correo.com"
              className={inputClass(!!errors.email)}
            />
          )}
        </FormField>
        <FormField label="Teléfono / WhatsApp" error={errors.telefono}>
          {(props) => (
            <input
              {...props}
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="664 123 4567"
              className={inputClass(!!errors.telefono)}
            />
          )}
        </FormField>
        <FormField label={tipo ? PEOPLE_LABEL[tipo] : "Número de personas"} hint="Aproximado, opcional" error={errors.personas}>
          {(props) => (
            <input
              {...props}
              name="personas"
              type="number"
              inputMode="numeric"
              min={1}
              className={inputClass(!!errors.personas)}
            />
          )}
        </FormField>
        {tipo !== "catering" && (
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-control border border-line-strong bg-paper px-3.5 py-3 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink sm:h-12">
            <input type="checkbox" name="refrigerador" className="size-4 accent-power" />
            Necesitamos refrigerador
          </label>
        )}
      </div>

      <FormField label="Cuéntanos más" hint="Horarios, fechas, dirección o lo que necesites. Opcional." error={errors.mensaje}>
        {(props) => (
          <textarea
            {...props}
            name="mensaje"
            rows={5}
            maxLength={MESSAGE_MAX}
            className={`${inputBase} py-3 ${errors.mensaje ? "border-danger" : "border-line-strong"}`}
          />
        )}
      </FormField>

      {/* Honeypot: hidden from people and assistive tech; bots that fill it get a fake success. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Sitio web
          <input name="sitio" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {siteKey ? (
        <TurnstileField key={turnstileKey} onToken={setTurnstileToken} />
      ) : (
        <p className="text-sm font-medium text-danger">
          El formulario no está disponible en este momento. Escríbenos por WhatsApp.
        </p>
      )}

      {message && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
          <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !siteKey || !turnstileToken}
        className={`${buttonPrimary} w-full sm:w-fit`}
      >
        {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
        Enviar solicitud
      </button>
    </form>
  );
}
