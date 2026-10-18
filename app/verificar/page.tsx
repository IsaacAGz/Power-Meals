"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { AuthShell } from "@/components/auth/AuthShell";

export default function VerificarPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setMessage("Este enlace no es válido o ya venció.");
      return;
    }
    // Dev remounts this page once. A second request would burn the single-use token and show an error
    // after the first request had already signed the person in.
    const key = `pm-verify:${token}`;
    let cancelled = false;
    (async () => {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "pending");
        try {
          const response = await fetch("/api/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          sessionStorage.setItem(key, JSON.stringify(await response.json()));
        } catch {
          sessionStorage.setItem(key, JSON.stringify({ ok: false, message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo." }));
        }
      }
      while (sessionStorage.getItem(key) === "pending") {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (cancelled) return;
      const result = JSON.parse(sessionStorage.getItem(key) || "{}") as {
        ok?: boolean;
        redirectTo?: string;
        message?: string;
      };
      if (result.ok && result.redirectTo) {
        router.replace(result.redirectTo);
        router.refresh();
        return;
      }
      setMessage(result.message ?? "Este enlace no es válido o ya venció.");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthShell title="Confirma tu correo" intro="Estamos abriendo tu cuenta.">
      {message ? (
        <p role="alert" className="text-sm font-medium text-[#B42318]">
          {message}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-[15px] text-muted">
          <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />
          Confirmando tu correo…
        </p>
      )}
    </AuthShell>
  );
}
