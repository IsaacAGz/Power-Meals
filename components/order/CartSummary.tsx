"use client";

import { Trash } from "@phosphor-icons/react";
import type { CartView } from "@/lib/cart/view";
import type { CartItem } from "@/lib/catalog/types";
import { formatCents, groupNames } from "@/lib/format";
import { QuantityStepper } from "./ChoiceGroup";

export function CartSummary({
  cart,
  busyKey,
  onSetQuantity,
}: {
  cart: CartView;
  busyKey: string | null;
  onSetQuantity: (key: string, item: CartItem, quantity: number) => void;
}) {
  if (cart.lines.length === 0) {
    return (
      <p className="rounded-frame border border-dashed border-line-strong p-5 text-[15px] text-muted">
        Aún no agregas platillos. Arma uno arriba o elige un paquete.
      </p>
    );
  }

  return (
    <div className="rounded-frame border border-line-strong bg-paper">
      <ul className="divide-y divide-line">
        {cart.lines.map((line) => (
          <li key={line.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] leading-snug font-semibold">{line.displayName}</p>
              <p className="mt-1 text-[13px] text-muted">{line.detail}</p>
              {line.slotNames.length > 0 && (
                <details className="mt-2 text-[13px] text-muted">
                  <summary className="cursor-pointer font-medium text-ink">Ver comidas</summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {groupNames(line.slotNames).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
              <QuantityStepper
                value={line.quantity}
                min={1}
                onChange={(quantity) => onSetQuantity(line.key, line.item, quantity)}
                disabled={busyKey === line.key}
                label={line.displayName}
              />
              <span className="w-20 text-right font-mono text-[15px] tabular-nums">{formatCents(line.lineTotalCents)}</span>
              <button
                type="button"
                onClick={() => onSetQuantity(line.key, line.item, 0)}
                disabled={busyKey === line.key}
                aria-label={`Quitar ${line.displayName}`}
                className="inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:text-ink disabled:opacity-35"
              >
                <Trash weight="bold" className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line-strong px-4 py-4">
        <span className="text-sm text-muted">
          {cart.mealCount} {cart.mealCount === 1 ? "platillo" : "platillos"}
        </span>
        <span className="font-mono text-xl font-medium tabular-nums">
          {formatCents(cart.totalCents)} <span className="text-sm text-muted">MXN</span>
        </span>
      </div>
    </div>
  );
}
