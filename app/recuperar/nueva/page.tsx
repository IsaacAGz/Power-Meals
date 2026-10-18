import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { textLink } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false },
};

export default async function NuevaContrasenaPage({ searchParams }: PageProps<"/recuperar/nueva">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  return (
    <AuthShell title="Nueva contraseña" intro="Elige una contraseña para entrar a tu cuenta.">
      {value ? (
        <NewPasswordForm token={value} />
      ) : (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm font-medium text-[#B42318]">
            Este enlace no es válido o ya venció.
          </p>
          <Link href="/recuperar" className={textLink}>
            Pedir otro enlace
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
