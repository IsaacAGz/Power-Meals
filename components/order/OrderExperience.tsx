"use client";

import { useState } from "react";
import { ArrowCounterClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { addToCart, reorder, setCartQuantity, type CartResult } from "@/lib/cart/client";
import { emptyCartView, type CartView } from "@/lib/cart/view";
import type { CartItem, Catalog } from "@/lib/catalog/types";
import { formatCents } from "@/lib/format";
import { CartSummary } from "./CartSummary";
import { CheckoutForm, type PointOption, type ZoneOption } from "./CheckoutForm";
import { MealBuilder } from "./MealBuilder";
import { PackageBuilder } from "./PackageBuilder";

export type RecentOrder = { id: string; orderNumber: number; totalCents: number; summary: string };

type Tab = "platillo" | "paquete";
type Notice = { tone: "ok" | "error"; text: string } | null;

export function OrderExperience({
  catalog,
  initialCart,
  zones,
  points,
  prefill,
  recentOrders,
  initial,
  openpayEnabled,
  signedIn,
}: {
  catalog: Catalog;
  initialCart: CartView;
  zones: ZoneOption[];
  points: PointOption[];
  prefill: { name: string; email: string; phone: string };
  recentOrders: RecentOrder[];
  initial: { template?: string; package?: string; zone?: string; point?: string };
  openpayEnabled: boolean;
  signedIn: boolean;
}) {
  const [cart, setCart] = useState(initialCart);
  const [tab, setTab] = useState<Tab>(initial.package ? "paquete" : "platillo");
  const [notice, setNotice] = useState<Notice>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function apply(result: CartResult, success?: string) {
    if (result.ok) {
      setCart(result.cart);
      setNotice(success ? { tone: "ok", text: success } : null);
    } else {
      setNotice({ tone: "error", text: result.message });
    }
    return result.ok;
  }

  async function add(item: CartItem, quantity: number) {
    return apply(await addToCart(item, quantity), "Agregado a tu pedido.");
  }

  async function changeQuantity(key: string, item: CartItem, quantity: number) {
    setBusyKey(key);
    apply(await setCartQuantity(item, quantity));
    setBusyKey(null);
  }

  async function repeat(order: RecentOrder) {
    setBusyKey(order.id);
    apply(await reorder(order.id), `Agregamos tu pedido #${order.orderNumber}.`);
    setBusyKey(null);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "platillo", label: "Arma tu platillo" },
    { id: "paquete", label: "Paquetes" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-14">
      {recentOrders.length > 0 && (
        <section aria-labelledby="pedir-de-nuevo">
          <h2 id="pedir-de-nuevo" className="font-display text-2xl font-extrabold tracking-tight">
            Pide de nuevo
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => repeat(order)}
                  disabled={busyKey === order.id}
                  className="flex w-full items-start gap-3 rounded-frame border border-line-strong bg-paper p-4 text-left transition-colors hover:border-ink disabled:opacity-60"
                >
                  <ArrowCounterClockwise weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">
                      Pedido #{order.orderNumber} · {formatCents(order.totalCents)}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] text-muted">{order.summary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Elige tus platillos">
        <div role="tablist" aria-label="Tipo de pedido" className="flex flex-wrap gap-2">
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={`tab-${option.id}`}
              aria-selected={tab === option.id}
              aria-controls={`panel-${option.id}`}
              onClick={() => setTab(option.id)}
              className={`h-10 rounded-control border px-4 text-[15px] font-semibold transition-colors ${
                tab === option.id ? "border-ink bg-ink text-cream" : "border-line-strong text-ink hover:border-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-8">
          {tab === "platillo" ? (
            <MealBuilder
              catalog={catalog}
              initialTemplate={initial.template}
              lines={cart.lines.filter((line) => line.item.kind === "meal")}
              busyKey={busyKey}
              onAdd={add}
              onSetQuantity={changeQuantity}
            />
          ) : (
            <PackageBuilder catalog={catalog} initialPackage={initial.package} onAdd={add} />
          )}
        </div>
      </section>

      <section aria-labelledby="tu-pedido">
        <h2 id="tu-pedido" className="mb-5 font-display text-2xl font-extrabold tracking-tight">
          Tu pedido
        </h2>
        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mb-4 flex items-center gap-2 text-sm font-medium ${notice.tone === "error" ? "text-[#B42318]" : "text-ink"}`}
          >
            {notice.tone === "error" ? (
              <WarningCircle weight="bold" className="size-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle weight="bold" className="size-4 shrink-0" aria-hidden />
            )}
            {notice.text}
          </p>
        )}
        <CartSummary cart={cart} busyKey={busyKey} onSetQuantity={changeQuantity} />
      </section>

      <CheckoutForm
        cart={cart}
        zones={zones}
        points={points}
        prefill={prefill}
        initialZone={initial.zone}
        initialPoint={initial.point}
        openpayEnabled={openpayEnabled}
        signedIn={signedIn}
        onWhatsApp={({ saved }) => {
          if (saved) {
            setCart(emptyCartView());
            setNotice({ tone: "ok", text: "Guardamos el pedido en tu cuenta como pedido por WhatsApp." });
          } else {
            setNotice({ tone: "ok", text: "Inicia sesión para guardar este pedido en tu cuenta." });
          }
        }}
      />
    </div>
  );
}
