"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { formatCents } from "@/lib/format";
import { advanceKitchenOrder } from "@/lib/kitchen/actions";
import {
  emptyKitchenCounts,
  KITCHEN_STATUSES,
  kitchenStatusLabels,
  nextKitchenStep,
  type KitchenBoard,
  type KitchenOrder,
  type KitchenStatus,
} from "@/lib/kitchen/types";
import { buttonDark, buttonPrimary } from "@/lib/ui";

const POLL_MS = 10_000;

const timeFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Tijuana",
});

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => void ctx.close();
  } catch {
    // Autoplay can block the first sound. The "Nuevo" badge still shows.
  }
}

function shiftCount(counts: KitchenBoard["counts"], from: KitchenStatus, to: KitchenStatus): KitchenBoard["counts"] {
  return { ...counts, [from]: Math.max(0, counts[from] - 1), [to]: counts[to] + 1 };
}

export function KitchenBoard({ initial }: { initial: KitchenBoard }) {
  const [board, setBoard] = useState(initial);
  const [filter, setFilter] = useState<KitchenStatus>("ordered_whatsapp");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const seen = useRef(new Set(initial.orders.map((order) => order.id)));
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    let timer = 0;
    let stopped = false;

    async function poll() {
      if (document.hidden || pendingRef.current) return;
      try {
        const response = await fetch("/api/kitchen/orders", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const next = (await response.json()) as KitchenBoard;
        const arrived = next.orders.filter((order) => !seen.current.has(order.id) && order.status !== "completed");
        for (const order of next.orders) seen.current.add(order.id);
        if (arrived.length > 0) {
          beep();
          setFreshIds(arrived.map((order) => order.id));
        } else {
          setFreshIds([]);
        }
        setBoard(next);
      } catch {
        // Keep the list on screen. The next tick tries again.
      }
    }

    function start() {
      window.clearInterval(timer);
      timer = window.setInterval(() => void poll(), POLL_MS);
    }

    function onVisible() {
      if (!document.hidden) void poll();
    }

    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function advance(order: KitchenOrder) {
    const step = nextKitchenStep[order.status];
    if (!step || pendingId) return;
    const previous = board;
    pendingRef.current = order.id;
    setPendingId(order.id);
    setError("");
    setBoard((current) => ({
      ...current,
      counts: shiftCount(current.counts, order.status, step.to),
      orders: current.orders.map((row) => (row.id === order.id ? { ...row, status: step.to } : row)),
    }));

    try {
      const result = await advanceKitchenOrder(order.id, order.status);
      if (!result.ok) {
        setBoard(previous);
        setError(result.message);
      }
    } catch {
      setBoard(previous);
      setError("No pudimos actualizar el pedido. Intenta de nuevo.");
    }
    pendingRef.current = null;
    setPendingId(null);
  }

  const visible = board.orders.filter((order) => order.status === filter);
  const counts = board.counts ?? emptyKitchenCounts();

  return (
    <div>
      <p className="text-[15px] font-semibold text-muted">Cocina {board.facilityName}</p>
      <h1 className="mt-2 font-display text-5xl leading-[1] font-extrabold tracking-[-0.03em] md:text-6xl">Pedidos</h1>

      <div role="tablist" aria-label="Estado del pedido" className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {KITCHEN_STATUSES.map((status) => {
          const selected = filter === status;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(status)}
              className={`flex h-12 shrink-0 items-center gap-2 rounded-control border px-4 text-[15px] font-semibold ${
                selected ? "border-ink bg-ink text-cream" : "border-line-strong bg-paper text-ink"
              }`}
            >
              {kitchenStatusLabels[status]}
              <span className={`font-mono text-[13px] tabular-nums ${selected ? "text-cream/70" : "text-muted"}`}>
                {counts[status]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-[#B42318]">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="mt-10 text-lg text-muted">No hay pedidos en {kitchenStatusLabels[filter]}.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              fresh={freshIds.includes(order.id)}
              pending={pendingId === order.id}
              onAdvance={() => void advance(order)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({
  order,
  fresh,
  pending,
  onAdvance,
}: {
  order: KitchenOrder;
  fresh: boolean;
  pending: boolean;
  onAdvance: () => void;
}) {
  const step = nextKitchenStep[order.status];
  const unpaid = order.status === "ordered_whatsapp";

  return (
    <li className="rounded-frame border border-line-strong bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-tight">Pedido #{order.orderNumber}</p>
          <p className="mt-1 text-[15px] text-muted">{timeFormat.format(new Date(order.createdAt))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fresh && (
            <span className="rounded-full bg-power px-3 py-1 text-[13px] font-semibold text-ink">Nuevo</span>
          )}
          {unpaid && (
            <span className="rounded-full border border-line-strong px-3 py-1 text-[13px] font-semibold text-ink">
              Transferencia pendiente
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-1 text-[16px] leading-relaxed">
        <p className="font-semibold">{order.customerName}</p>
        <p className="font-mono tabular-nums">{order.customerPhone}</p>
        <p>
          {order.fulfillment === "delivery" ? "Entrega" : "Recolección"}
          {order.place ? ` · ${order.place}` : ""}
          {order.address ? <span className="block text-muted">{order.address}</span> : null}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
        {order.lines.map((line, index) => (
          <li key={`${line.name}-${index}`}>
            <p className="text-[16px] font-semibold">
              {line.quantity}× {line.name}
            </p>
            {line.detail && <p className="text-[14px] text-muted">{line.detail}</p>}
            {line.slots.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 pl-4">
                {line.slots.map((slot, slotIndex) => (
                  <li key={`${slot.name}-${slotIndex}`} className="text-[15px]">
                    {slot.name}
                    {slot.detail && <span className="block text-[13px] text-muted">{slot.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {order.notes && <p className="mt-4 text-[15px]">Nota: {order.notes}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-lg tabular-nums">{formatCents(order.totalCents)}</p>
        {step && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={pending}
            className={`${unpaid ? buttonPrimary : buttonDark} h-14 px-6 text-base`}
          >
            {pending && <CircleNotch weight="bold" className="size-5 motion-safe:animate-spin" aria-hidden />}
            {step.label}
          </button>
        )}
      </div>
    </li>
  );
}
