"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { buttonPrimary, buttonSecondary, container } from "@/lib/ui";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className={`${container} flex flex-col items-start gap-6 py-24`}>
      <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Algo salió mal</h1>
      <p className="max-w-[48ch] text-lg text-muted">
        No pudimos cargar esta página. Intenta de nuevo; si sigue fallando, escríbenos por WhatsApp.
      </p>
      {error.digest ? <p className="font-mono text-sm text-muted">Código: {error.digest}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonPrimary} onClick={() => retry()}>
          Intentar de nuevo
        </button>
        <Link href="/" className={buttonSecondary}>
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
