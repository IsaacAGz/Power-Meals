/** Mirrors `order_status` in lib/db/schema.ts. This file stays free of the database so the receipt can import it in the browser. */
type OrderStatus =
  | "pending_payment"
  | "ordered_whatsapp"
  | "paid"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

/** What the receipt and its poll may show. The phone number never appears here. */
export type PublicStatus = "pending" | "whatsapp" | "paid" | "preparing" | "ready" | "completed" | "failed";

export type ReceiptOrigin = "whatsapp" | "card";

export function toPublicStatus(status: OrderStatus): PublicStatus {
  if (status === "pending_payment") return "pending";
  if (status === "cancelled") return "failed";
  if (status === "ordered_whatsapp") return "whatsapp";
  if (status === "confirmed") return "paid";
  return status;
}

export function receiptOrigin(status: PublicStatus, provider: string | null): ReceiptOrigin {
  return status === "whatsapp" || provider === "whatsapp" ? "whatsapp" : "card";
}

/** Payment is confirmed, including later kitchen steps. `confirmed` is unused and already mapped to `paid`. */
export function isSettledPublicStatus(status: PublicStatus): boolean {
  return status === "paid" || status === "preparing" || status === "ready" || status === "completed";
}

const stepLabels: Record<Exclude<PublicStatus, "failed">, string> = {
  pending: "Pago pendiente",
  whatsapp: "Pedido por WhatsApp",
  paid: "Pagado",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Entregado",
};

export function receiptSteps(origin: ReceiptOrigin): { status: Exclude<PublicStatus, "failed">; label: string }[] {
  const statuses = [
    origin === "whatsapp" ? "whatsapp" : "pending",
    "paid",
    "preparing",
    "ready",
    "completed",
  ] as const;
  return statuses.map((status) => ({ status, label: stepLabels[status] }));
}

export function receiptStepIndex(status: PublicStatus, origin: ReceiptOrigin): number {
  const index = receiptSteps(origin).findIndex((step) => step.status === status);
  return index === -1 ? 0 : index;
}

export function receiptLead(status: PublicStatus, firstName: string): { title: string; detail: string } {
  const thanks = `¡Gracias, ${firstName}!`;
  switch (status) {
    case "pending":
      return { title: "Recibimos tu pedido", detail: "En cuanto se confirme el pago, el estado se actualizará aquí." };
    case "whatsapp":
      return {
        title: thanks,
        detail: "Quedó guardado como pedido por WhatsApp. El pago por transferencia sigue pendiente.",
      };
    case "paid":
      return { title: thanks, detail: "Tu pago está confirmado. Aquí verás cuando empiece la preparación." };
    case "preparing":
      return { title: thanks, detail: "Tu pedido está en preparación." };
    case "ready":
      return { title: thanks, detail: "Tu pedido está listo." };
    case "completed":
      return { title: thanks, detail: "Tu pedido fue entregado." };
    case "failed":
      return { title: "Tu pago no se completó", detail: "No se hizo ningún cargo." };
  }
}
