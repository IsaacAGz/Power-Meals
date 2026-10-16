"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowCounterClockwise, CircleNotch } from "@phosphor-icons/react";
import { reorder } from "@/lib/cart/client";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setPending(true);
    setError("");
    const result = await reorder(orderId);
    if (result.ok) {
      router.push("/pedido");
      return;
    }
    setError(result.message);
    setPending(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-power decoration-2 underline-offset-4 hover:decoration-ink disabled:opacity-60"
      >
        {pending ? (
          <CircleNotch weight="bold" className="size-3.5 motion-safe:animate-spin" aria-hidden />
        ) : (
          <ArrowCounterClockwise weight="bold" className="size-3.5" aria-hidden />
        )}
        Pedir de nuevo
      </button>
      {error && (
        <p role="alert" className="max-w-[28ch] text-right text-[13px] text-[#B42318]">
          {error}
        </p>
      )}
    </div>
  );
}
