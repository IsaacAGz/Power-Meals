import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser, homeFor } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/validation";
import { textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: { index: false },
};

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "");

  const user = await getCurrentUser();
  if (user) redirect(nextPath || homeFor(user));

  return (
    <AuthShell title="Crea tu cuenta" intro="Guarda tus pedidos y repite tus favoritos sin volver a capturarlos.">
      <AuthForm mode="register" next={nextPath || undefined} />
      <p className="mt-6 text-[15px] text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={nextPath ? `/ingresar?next=${encodeURIComponent(nextPath)}` : "/ingresar"} className={textLink}>
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
