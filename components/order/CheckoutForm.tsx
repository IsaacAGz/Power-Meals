"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { CaretDown, CircleNotch, CreditCard, WarningCircle, WhatsappLogo } from "@phosphor-icons/react";
import type { CartView } from "@/lib/cart/view";
import { formatCents, groupNames } from "@/lib/format";
import { validateCheckout, type CheckoutErrors, type CheckoutField, type CheckoutInput } from "@/lib/orders/checkout-input";
import { buttonPrimary, inputBase, inputClass, textLink } from "@/lib/ui";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { FormField } from "../FormField";
export type ZoneOption = { slug: string; name: string; days: string };
export type PointOption = { slug: string; name: string; address: string };

type Pending = "openpay" | "whatsapp" | null;

export function CheckoutForm({
  cart,
  zones,
  points,
  prefill,
  initialZone,
  initialPoint,
  openpayEnabled,
  signedIn,
  onWhatsApp,
}: {
  cart: CartView;
  zones: ZoneOption[];
  points: PointOption[];
  prefill: { name: string; email: string; phone: string };
  initialZone?: string;
  initialPoint?: string;
  openpayEnabled: boolean;
  signedIn: boolean;
  onWhatsApp?: (result: { saved: boolean }) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState<CheckoutInput>({
    nombre: prefill.name,
    telefono: prefill.phone,
    correo: prefill.email,
    metodo: "recoleccion",
    zona: initialZone ?? "",
    direccion: "",
    punto: initialPoint ?? "",
    notas: "",
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");

  const empty = cart.lines.length === 0;
  const set = (patch: Partial<CheckoutInput>) => setInput((current) => ({ ...current, ...patch }));

  function check(requireEmail: boolean) {
    const found = validateCheckout(
      { ...input, nombre: input.nombre.trim(), correo: input.correo.trim().toLowerCase(), direccion: input.direccion.trim() },
      { requireEmail },
    );
    setErrors(found);
    const first = (Object.keys(found) as CheckoutField[])[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    if (empty) setMessage("Agrega al menos un platillo a tu pedido.");
    return !first && !empty;
  }

  async function payWithOpenpay() {
    setMessage("");
    if (!check(true)) return;

    setPending("openpay");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as { ok: boolean; redirectUrl?: string; message?: string; errors?: CheckoutErrors };
      if (data.ok && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      setErrors(data.errors ?? {});
      setMessage(data.message ?? "");
    } catch {
      setMessage("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
    }
    setPending(null);
  }

  async function sendWhatsApp() {
    setMessage("");
    if (!check(false)) return;

    // Open the tab during the click, then point it at WhatsApp once the order is stored.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setWhatsAppUrl("");
    setPending("whatsapp");

    try {
      const response = await fetch("/api/orders/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as { ok: boolean; saved?: boolean; message?: string; errors?: CheckoutErrors };
      if (!data.ok) {
        popup?.close();
        setErrors(data.errors ?? {});
        setMessage(data.message ?? "No pudimos guardar el pedido.");
        setPending(null);
        return;
      }

      onWhatsApp?.({ saved: data.saved === true });
      const zone = zones.find((row) => row.slug === input.zona);
      const point = points.find((row) => row.slug === input.punto);
      const text = buildOrderMessage({
        nombre: input.nombre.trim(),
        telefono: input.telefono.trim(),
        metodo: input.metodo,
        zona: zone?.name,
        direccion: input.direccion.trim(),
        punto: point ? (point.address ? `${point.name}, ${point.address}` : point.name) : undefined,
        lineas: cart.lines.map((line) => ({
          name: line.slotNames.length > 0 ? `${line.displayName} (${groupNames(line.slotNames).join("; ")})` : line.displayName,
          price: line.unitPriceCents / 100,
          quantity: line.quantity,
        })),
        notas: input.notas.trim() || undefined,
      });
      const url = buildWhatsAppUrl(text);
      if (popup) {
        popup.location.href = url;
        setPending(null);
        return;
      }
      setWhatsAppUrl(url);
    } catch {
      popup?.close();
      setMessage("No pudimos conectar. Revisa tu conexión e intenta de nuevo.");
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (openpayEnabled) void payWithOpenpay();
    else void sendWhatsApp();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-10">
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-5 font-display text-2xl font-extrabold tracking-tight">Tus datos</legend>
        <FormField label="Nombre" error={errors.nombre}>
          {(props) => (
            <input
              {...props}
              data-field="nombre"
              type="text"
              autoComplete="name"
              value={input.nombre}
              onChange={(event) => set({ nombre: event.target.value })}
              className={inputClass(!!errors.nombre)}
              placeholder="Mariana López"
            />
          )}
        </FormField>
        <FormField label="Teléfono" error={errors.telefono}>
          {(props) => (
            <input
              {...props}
              data-field="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={input.telefono}
              onChange={(event) => set({ telefono: event.target.value })}
              className={inputClass(!!errors.telefono)}
              placeholder="664 123 4567"
            />
          )}
        </FormField>
        <div className="sm:col-span-2">
          <FormField
            label="Correo"
            error={errors.correo}
            hint={
              openpayEnabled
                ? "Con este correo puedes guardar el pedido en una cuenta después de pagar."
                : signedIn
                  ? "Este pedido se guarda en tu cuenta al enviarlo."
                  : "Si inicias sesión después, guardamos el pedido en tu cuenta."
            }
          >
            {(props) => (
              <input
                {...props}
                data-field="correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={input.correo}
                onChange={(event) => set({ correo: event.target.value })}
                className={inputClass(!!errors.correo)}
                placeholder="tu@correo.com"
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-5 font-display text-2xl font-extrabold tracking-tight">Entrega o recolección</legend>
        <div role="radiogroup" aria-label="Método" className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "entrega", label: "Entrega a domicilio", disabled: true },
              { id: "recoleccion", label: "Recolección", disabled: false },
            ] as const
          ).map((option) => (
            <label
              key={option.id}
              className={`flex h-12 items-center justify-center rounded-control border px-3 text-center text-[15px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                option.disabled
                  ? "cursor-not-allowed border-line-strong bg-paper text-muted"
                  : input.metodo === option.id
                    ? "border-ink bg-ink text-cream"
                    : "cursor-pointer border-line-strong bg-paper text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={option.id}
                checked={input.metodo === option.id}
                disabled={option.disabled}
                onChange={() => set({ metodo: option.id })}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-muted">La entrega a domicilio no está disponible por ahora.</p>

        {input.metodo === "entrega" ? (
          <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
            <FormField
              label="Zona"
              error={errors.zona}
              hint={zones.find((zone) => zone.slug === input.zona)?.days ?? "¿No ves tu colonia? Pregúntanos por WhatsApp."}
            >
              {(props) => (
                <SelectShell>
                  <select
                    {...props}
                    data-field="zona"
                    value={input.zona}
                    onChange={(event) => set({ zona: event.target.value })}
                    className={`${inputClass(!!errors.zona)} appearance-none pr-10`}
                  >
                    <option value="">Elige una zona</option>
                    {zones.map((zone) => (
                      <option key={zone.slug} value={zone.slug}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              )}
            </FormField>
            <FormField label="Dirección" error={errors.direccion}>
              {(props) => (
                <input
                  {...props}
                  data-field="direccion"
                  type="text"
                  autoComplete="street-address"
                  value={input.direccion}
                  onChange={(event) => set({ direccion: event.target.value })}
                  className={inputClass(!!errors.direccion)}
                  placeholder="Calle, número y colonia"
                />
              )}
            </FormField>
          </div>
        ) : (
          <FormField label="Punto de recolección" error={errors.punto}>
            {(props) => (
              <SelectShell>
                <select
                  {...props}
                  data-field="punto"
                  value={input.punto}
                  onChange={(event) => set({ punto: event.target.value })}
                  className={`${inputClass(!!errors.punto)} appearance-none pr-10`}
                >
                  <option value="">Elige un punto</option>
                  {points.map((point) => (
                    <option key={point.slug} value={point.slug}>
                      {point.address ? `${point.name}, ${point.address}` : point.name}
                    </option>
                  ))}
                </select>
              </SelectShell>
            )}
          </FormField>
        )}
      </fieldset>

      <FormField label="Notas (opcional)" hint="Alergias, sin cebolla, horario preferido, etc.">
        {(props) => (
          <textarea
            {...props}
            rows={3}
            value={input.notas}
            onChange={(event) => set({ notas: event.target.value })}
            className={`${inputBase} border-line-strong py-3 leading-relaxed`}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-4 rounded-frame border border-line-strong bg-paper p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">Total a pagar</p>
            <p className="mt-1 font-mono text-2xl font-medium tabular-nums">
              {formatCents(cart.totalCents)} <span className="text-sm text-muted">MXN</span>
            </p>
          </div>
          {openpayEnabled ? (
            <button type="submit" disabled={pending === "openpay"} className={`${buttonPrimary} sm:min-w-[260px]`}>
              {pending === "openpay" ? (
                <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
              ) : (
                <CreditCard weight="bold" className="size-5" aria-hidden />
              )}
              {pending === "openpay" ? "Abriendo Openpay" : "Pagar con Openpay"}
            </button>
          ) : (
            <button type="submit" disabled={pending === "whatsapp" && !whatsAppUrl} className={`${buttonPrimary} sm:min-w-[260px]`}>
              {pending === "whatsapp" && !whatsAppUrl ? (
                <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
              ) : (
                <WhatsappLogo weight="bold" className="size-5" aria-hidden />
              )}
              {pending === "whatsapp" && !whatsAppUrl ? "Abriendo WhatsApp" : "Enviar pedido por WhatsApp"}
            </button>
          )}
        </div>
        {message && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#B42318]">
            <WarningCircle weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {message}
          </p>
        )}
        <div className="border-t border-line pt-4 text-[15px]">
          {openpayEnabled && (
            <button type="button" onClick={() => void sendWhatsApp()} className={`${textLink} inline-flex items-center gap-1.5`}>
              <WhatsappLogo weight="bold" className="size-4" aria-hidden />
              ¿Prefieres pagar por WhatsApp?
            </button>
          )}
          <p className={openpayEnabled ? "mt-1 text-[13px] text-muted" : "text-[13px] text-muted"}>
            Te enviamos los datos para pagar por transferencia bancaria.
          </p>
          {pending === "whatsapp" && whatsAppUrl && (
            <p role="status" className="mt-3 text-sm">
              Tu navegador bloqueó la ventana nueva.{" "}
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                Abrir WhatsApp
              </a>
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <CaretDown
        weight="bold"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink"
      />
    </div>
  );
}
