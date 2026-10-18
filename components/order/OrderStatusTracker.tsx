"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CircleNotch, Clock } from "@phosphor-icons/react";
import {
  receiptStepIndex,
  receiptSteps,
  type PublicStatus,
  type ReceiptOrigin,
} from "@/lib/orders/public-status";

const KITCHEN_POLL_MS = 10_000;
const PAYMENT_POLL_MS = 2_500;
const PAYMENT_WAIT_MS = 60_000;

/** Shows the kitchen steps and polls until the order is delivered or the card payment is cancelled. */
export function OrderStatusTracker({
  orderRef,
  status,
  origin,
  cancelPath,
}: {
  orderRef: string;
  status: PublicStatus;
  origin: ReceiptOrigin;
  cancelPath: string;
}) {
  const router = useRouter();
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const steps = receiptSteps(origin);
  const current = receiptStepIndex(status, origin);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    let timer = 0;
    let stopped = false;
    const startedAt = Date.now();
    const waitingForPayment = status === "pending";

    async function poll() {
      if (stopped) return;
      if (!document.hidden) {
        try {
          const response = await fetch(`/api/orders/public-status?order_ref=${encodeURIComponent(orderRef)}`, {
            cache: "no-store",
          });
          if (response.ok && !stopped) {
            const body = (await response.json()) as { status: PublicStatus };
            if (body.status === "failed") {
              router.replace(cancelPath);
              return;
            }
            if (body.status !== status) router.refresh();
          }
        } catch {
          // Keep the last step on screen. The next tick tries again.
        }
      }
      if (stopped) return;
      const elapsed = Date.now() - startedAt;
      if (waitingForPayment && elapsed >= PAYMENT_WAIT_MS) setPaymentTimedOut(true);
      const delay = waitingForPayment && elapsed < PAYMENT_WAIT_MS ? PAYMENT_POLL_MS : KITCHEN_POLL_MS;
      timer = window.setTimeout(poll, delay);
    }

    function onVisible() {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void poll();
    }

    timer = window.setTimeout(poll, waitingForPayment ? PAYMENT_POLL_MS : KITCHEN_POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderRef, status, cancelPath, router]);

  return (
    <div className="flex flex-col gap-4">
      {status === "pending" &&
        (paymentTimedOut ? (
          <div role="status" className="flex gap-4 rounded-frame border border-line-strong bg-paper p-6">
            <Clock weight="bold" className="size-7 shrink-0" aria-hidden />
            <div>
              <p className="font-display text-xl font-bold tracking-tight">Tu pago sigue en verificación</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Openpay a veces tarda unos minutos en confirmar. Esta página se actualiza sola, o escríbenos por WhatsApp
                con tu número de pedido.
              </p>
            </div>
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-4 rounded-frame border border-line-strong bg-paper p-6"
          >
            <CircleNotch weight="bold" className="size-7 shrink-0 motion-safe:animate-spin" aria-hidden />
            <div>
              <p className="font-display text-xl font-bold tracking-tight">Verificando tu pago…</p>
              <p className="mt-1 text-[15px] text-muted">No cierres esta página; tarda unos segundos.</p>
            </div>
          </div>
        ))}

      <ol aria-label="Estado del pedido" className="rounded-frame border border-line-strong bg-paper px-6 py-5">
        {steps.map((step, index) => {
          const done = index < current || (status === "completed" && index === current);
          const active = index === current && !done;
          return (
            <li key={step.status} className="grid grid-cols-[1.75rem_1fr] gap-x-4" aria-current={active ? "step" : undefined}>
              <span className="relative flex justify-center">
                {index < steps.length - 1 && (
                  <span className={`absolute top-7 bottom-0 w-px ${done ? "bg-ink" : "bg-line-strong"}`} aria-hidden />
                )}
                <span
                  className={`relative z-10 flex size-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                    done ? "bg-ink text-cream" : active ? "bg-power text-ink" : "border border-line-strong text-muted"
                  }`}
                >
                  {done ? <Check weight="bold" className="size-3.5" aria-hidden /> : index + 1}
                </span>
              </span>
              <span
                className={`text-[15px] leading-7 ${index < steps.length - 1 ? "pb-5" : ""} ${
                  active ? "font-semibold text-ink" : done ? "text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
