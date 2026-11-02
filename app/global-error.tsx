"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { buttonPrimary } from "@/lib/ui";
import "./globals.css";

// Replaces the root layout when it fails, so it renders its own document without the header and footer.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-MX">
      <body className="flex min-h-[100dvh] flex-col items-start justify-center gap-6 bg-cream px-6 text-ink sm:px-10">
        <title>Algo salió mal | Power Meals</title>
        <h1 className="text-4xl font-extrabold tracking-tight">Algo salió mal</h1>
        <p className="max-w-[48ch] text-lg">Intenta de nuevo en un momento. Si sigue fallando, escríbenos por WhatsApp.</p>
        {error.digest ? <p className="font-mono text-sm">Código: {error.digest}</p> : null}
        <button type="button" className={buttonPrimary} onClick={() => retry()}>
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}
