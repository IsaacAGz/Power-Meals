"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignOut } from "@phosphor-icons/react";
import { buttonSecondary } from "@/lib/ui";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={logout} disabled={pending} className={buttonSecondary}>
      <SignOut weight="bold" className="size-4" aria-hidden />
      Cerrar sesión
    </button>
  );
}
