import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";
import { getCurrentUser, homeFor } from "@/lib/auth/dal";
import { textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
  robots: { index: false },
};

export default async function RecuperarPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));

  return (
    <AuthShell title="Restablece tu contraseña" intro="Te enviamos un enlace para elegir una nueva contraseña.">
      <ResetRequestForm />
      <p className="mt-6 text-[15px] text-muted">
        <Link href="/ingresar" className={textLink}>
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
