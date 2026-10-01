"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowCounterClockwise,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Minus,
  Plus,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { dishes, formatMXN, getDish } from "@/lib/menu-data";
import { getPickupPoint, getZone, pickupPoints, zones } from "@/lib/locations-data";
import { buildOrderMessage, buildWhatsAppUrl, orderTotal, type OrderLine } from "@/lib/whatsapp";
import { buttonPrimary, buttonSecondary } from "@/lib/ui";

type Metodo = "entrega" | "recoleccion";
type Status = "idle" | "loading" | "success" | "blocked";
type Field = "nombre" | "telefono" | "zona" | "direccion" | "punto" | "platillos";
type Errors = Partial<Record<Field, string>>;

const inputBase =
  "w-full rounded-control border bg-paper px-3.5 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";
const inputClass = (invalid: boolean) =>
  `${inputBase} h-12 ${invalid ? "border-[#B42318]" : "border-line-strong"}`;

export function OrderForm() {
  const reduce = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("entrega");
  const [zona, setZona] = useState("");
  const [direccion, setDireccion] = useState("");
  const [punto, setPunto] = useState(startingPoint?.slug ?? "");
  const [notas, setNotas] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [whatsAppUrl, setWhatsAppUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zone = getZone(params.get("zona"));
    const dish = getDish(params.get("platillo"));
    const point = getPickupPoint(params.get("punto"));
    if (zone) setZona(zone.slug);
    if (dish) setQuantities((current) => ({ ...current, [dish.slug]: current[dish.slug] || 1 }));
    if (point) {
      setMetodo("recoleccion");
      setPunto(point.slug);
    }
  }, []);

  const lines: OrderLine[] = useMemo(
    () =>
      dishes
        .filter((dish) => (quantities[dish.slug] ?? 0) > 0)
        .map((dish) => ({ name: dish.name, price: dish.price, quantity: quantities[dish.slug] })),
    [quantities],
  );
  const total = orderTotal(lines);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  function changeQuantity(slug: string, delta: number) {
    setQuantities((current) => {
      const next = Math.max(0, Math.min(20, (current[slug] ?? 0) + delta));
      return { ...current, [slug]: next };
    });
    if (errors.platillos) setErrors((current) => ({ ...current, platillos: undefined }));
  }

  function validate(): Errors {
    const found: Errors = {};
    if (nombre.trim().length < 2) found.nombre = "Escribe tu nombre.";
    if (telefono.replace(/\D/g, "").length < 10) found.telefono = "Escribe un teléfono de al menos 10 dígitos.";
    if (metodo === "entrega") {
      if (!zona) found.zona = "Elige tu zona de entrega.";
      if (direccion.trim().length < 6) found.direccion = "Escribe tu dirección con calle y número.";
    } else if (!punto) {
      found.punto = "Elige un punto de recolección.";
    }
    if (count === 0) found.platillos = "Agrega al menos un platillo.";
    return found;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    const firstInvalid = (Object.keys(found) as Field[])[0];
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }

    const message = buildOrderMessage({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      metodo,
      zona: getZone(zona)?.name,
      direccion: direccion.trim(),
      punto: getPickupPoint(punto)?.name,
      lineas: lines,
      notas: notas.trim() || undefined,
    });
    const url = buildWhatsAppUrl(message);
    setWhatsAppUrl(url);
    setStatus("loading");

    const opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
    window.setTimeout(() => setStatus(opened ? "success" : "blocked"), 500);
  }

  function reset() {
    setQuantities({});
    setNotas("");
    setErrors({});
    setStatus("idle");
  }

  const swap = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status === "success" || status === "blocked" ? (
        <motion.div key="result" {...swap} role="status" aria-live="polite" className="rounded-frame border border-line-strong bg-paper p-6 sm:p-10">
          {status === "success" ? (
            <>
              <CheckCircle weight="bold" className="size-10 text-ink" aria-hidden />
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Tu pedido está listo en WhatsApp</h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                Envía el mensaje que abrimos en WhatsApp. Te confirmamos disponibilidad y te compartimos los datos
                bancarios para pagar por transferencia.
              </p>
            </>
          ) : (
            <>
              <WarningCircle weight="bold" className="size-10 text-[#B42318]" aria-hidden />
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">No pudimos abrir WhatsApp</h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                Tu navegador bloqueó la ventana nueva. Tu pedido ya está armado: abre WhatsApp con el botón de abajo.
              </p>
            </>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className={buttonPrimary}>
              <WhatsappLogo weight="bold" className="size-5" aria-hidden />
              {status === "success" ? "Abrir de nuevo" : "Abrir WhatsApp"}
            </a>
            <button type="button" onClick={reset} className={buttonSecondary}>
              <ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />
              Nuevo pedido
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.form key="form" {...swap} ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="mb-5 font-display text-2xl font-extrabold tracking-tight">Tus datos</legend>
            <FormField label="Nombre" error={errors.nombre}>
              {(props) => (
                <input
                  {...props}
                  data-field="nombre"
                  type="text"
                  autoComplete="name"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
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
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  className={inputClass(!!errors.telefono)}
                  placeholder="664 123 4567"
                />
              )}
            </FormField>
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="mb-5 font-display text-2xl font-extrabold tracking-tight">Entrega o recolección</legend>
            <div role="radiogroup" aria-label="Método" className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "entrega", label: "Entrega a domicilio" },
                  { id: "recoleccion", label: "Recolección" },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={`flex h-12 cursor-pointer items-center justify-center rounded-control border px-3 text-center text-[15px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                    metodo === option.id ? "border-ink bg-ink text-cream" : "border-line-strong bg-paper text-ink hover:border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="metodo"
                    value={option.id}
                    checked={metodo === option.id}
                    onChange={() => setMetodo(option.id)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {metodo === "entrega" ? (
              <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
                <FormField label="Zona" error={errors.zona} hint="¿No ves tu colonia? Pregúntanos por WhatsApp.">
                  {(props) => (
                    <SelectShell>
                      <select
                        {...props}
                        data-field="zona"
                        value={zona}
                        onChange={(event) => setZona(event.target.value)}
                        className={`${inputClass(!!errors.zona)} appearance-none pr-10`}
                      >
                        <option value="">Elige una zona</option>
                        {zones.map((option) => (
                          <option key={option.slug} value={option.slug}>
                            {option.name}
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
                      value={direccion}
                      onChange={(event) => setDireccion(event.target.value)}
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
                      value={punto}
                      onChange={(event) => setPunto(event.target.value)}
                      className={`${inputClass(!!errors.punto)} appearance-none pr-10`}
                    >
                      <option value="">Elige un punto</option>
                      {pickupPoints.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.name}, {option.address}
                        </option>
                      ))}
                    </select>
                  </SelectShell>
                )}
              </FormField>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-display text-2xl font-extrabold tracking-tight">Detalle del pedido</legend>
            <p className="mt-2 text-sm text-muted">Elige platillos y cantidades. Precios por porción en MXN.</p>
            <ul
              tabIndex={-1}
              data-field="platillos"
              aria-describedby={errors.platillos ? "error-platillos" : undefined}
              className={`mt-5 grid gap-2 rounded-frame focus:outline-none sm:grid-cols-2 ${errors.platillos ? "ring-1 ring-[#B42318] ring-offset-4 ring-offset-cream" : ""}`}
            >
              {dishes.map((dish) => {
                const quantity = quantities[dish.slug] ?? 0;
                return (
                  <li
                    key={dish.slug}
                    className={`flex items-center gap-3 rounded-frame border p-2.5 transition-colors ${
                      quantity > 0 ? "border-ink bg-paper" : "border-line bg-paper/60"
                    }`}
                  >
                    <Image
                      src={dish.image}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-[8px] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] leading-tight font-semibold">{dish.name}</p>
                      <p className="mt-1 font-mono text-[13px] text-muted">{formatMXN(dish.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changeQuantity(dish.slug, -1)}
                        disabled={quantity === 0}
                        aria-label={`Quitar un ${dish.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-control border border-line-strong text-ink transition-transform active:scale-[0.94] disabled:opacity-35"
                      >
                        <Minus weight="bold" className="size-4" />
                      </button>
                      <span className="w-7 text-center font-mono text-[15px] tabular-nums" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(dish.slug, 1)}
                        aria-label={`Agregar un ${dish.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-control bg-ink text-cream transition-transform active:scale-[0.94]"
                      >
                        <Plus weight="bold" className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {errors.platillos && (
              <p id="error-platillos" className="mt-3 text-sm font-medium text-[#B42318]">
                {errors.platillos}
              </p>
            )}
          </fieldset>

          <FormField label="Notas (opcional)" hint="Alergias, sin cebolla, horario preferido, etc.">
            {(props) => (
              <textarea
                {...props}
                rows={3}
                value={notas}
                onChange={(event) => setNotas(event.target.value)}
                className={`${inputBase} border-line-strong py-3 leading-relaxed`}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-5 rounded-frame border border-line-strong bg-paper p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm text-muted">
                {count === 0 ? "Aún no agregas platillos" : `${count} ${count === 1 ? "platillo" : "platillos"}`}
              </p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums">
                {formatMXN(total)} <span className="text-sm text-muted">MXN</span>
              </p>
            </div>
            <button type="submit" disabled={status === "loading"} className={`${buttonPrimary} sm:min-w-[240px]`}>
              {status === "loading" ? (
                <>
                  <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
                  Abriendo WhatsApp
                </>
              ) : (
                <>
                  <WhatsappLogo weight="bold" className="size-5" aria-hidden />
                  Enviar por WhatsApp
                </>
              )}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
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

type FieldProps = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: FieldProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}
