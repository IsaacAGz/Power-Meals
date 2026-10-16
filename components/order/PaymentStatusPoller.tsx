"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleNotch, Clock } from "@phosphor-icons/react";

const INTERVAL_MS = 2_500;
const MAX_WAIT_MS = 60_000;

/** Waits for the Openpay webhook to mark the order paid; the redirect alone never does. */
export function PaymentStatusPoller({ orderRef, cancelPath }: { orderRef: string; cancelPath: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    let timer: number | undefined;
    let stopped = false;

    async function poll() {
      try {
        const response = await fetch(`/api/orders/public-status?order_ref=${encodeURIComponent(orderRef)}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const { status } = (await response.json()) as { status: string };
          if (status === "paid") {
            router.refresh();
            return;
          }
          if (status === "failed") {
            router.replace(cancelPath);
            return;
          }
        }
      } catch {}
      if (stopped) return;
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, INTERVAL_MS);
    }

    timer = window.setTimeout(poll, INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [orderRef, cancelPath, router]);

  if (timedOut) {
    return (
      <div role="status" className="flex gap-4 rounded-frame border border-line-strong bg-paper p-6">
        <Clock weight="bold" className="size-7 shrink-0" aria-hidden />
        <div>
          <p className="font-display text-xl font-bold tracking-tight">Tu pago sigue en verificación</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Openpay a veces tarda unos minutos en confirmar. Guarda este enlace y vuelve más tarde, o escríbenos por
            WhatsApp con tu número de pedido.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-frame border border-line-strong bg-paper p-6">
      <CircleNotch weight="bold" className="size-7 shrink-0 motion-safe:animate-spin" aria-hidden />
      <div>
        <p className="font-display text-xl font-bold tracking-tight">Verificando tu pago…</p>
        <p className="mt-1 text-[15px] text-muted">No cierres esta página; tarda unos segundos.</p>
      </div>
    </div>
  );
}
