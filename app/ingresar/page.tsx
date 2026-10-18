import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser, homeFor } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/validation";
import { textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false },
};

export default async function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "");

  const user = await getCurrentUser();
  if (user) redirect(nextPath || homeFor(user));

  return (
    <AuthShell title="Inicia sesión" intro="Consulta tus pedidos y pide más rápido la próxima vez.">
      <AuthForm mode="login" next={nextPath || undefined} />
      <p className="mt-6 text-[15px] text-muted">
        <Link href="/recuperar" className={textLink}>
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="mt-3 text-[15px] text-muted">
        ¿No tienes cuenta?{" "}
        <Link href={nextPath ? `/registro?next=${encodeURIComponent(nextPath)}` : "/registro"} className={textLink}>
          Crea una
        </Link>
      </p>
    </AuthShell>
  );
}
