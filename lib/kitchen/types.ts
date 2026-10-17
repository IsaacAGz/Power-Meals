export const KITCHEN_STATUSES = ["ordered_whatsapp", "paid", "preparing", "ready", "completed"] as const;

export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const kitchenStatusLabels: Record<KitchenStatus, string> = {
  ordered_whatsapp: "Pedido por WhatsApp",
  paid: "Pagado",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Entregado",
};

/** The one forward step each column offers. WhatsApp orders become paid only through the first one. */
export const nextKitchenStep: Partial<Record<KitchenStatus, { to: KitchenStatus; label: string }>> = {
  ordered_whatsapp: { to: "paid", label: "Confirmar transferencia" },
  paid: { to: "preparing", label: "Empezar a preparar" },
  preparing: { to: "ready", label: "Marcar listo" },
  ready: { to: "completed", label: "Marcar entregado" },
};

export type KitchenSlot = { name: string; detail: string };

export type KitchenLine = { name: string; quantity: number; detail: string; slots: KitchenSlot[] };

export type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: KitchenStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  fulfillment: "delivery" | "pickup";
  place: string;
  address: string | null;
  notes: string | null;
  totalCents: number;
  lines: KitchenLine[];
};

export type KitchenBoard = {
  facilityName: string;
  orders: KitchenOrder[];
  counts: Record<KitchenStatus, number>;
};

export function emptyKitchenCounts(): Record<KitchenStatus, number> {
  return { ordered_whatsapp: 0, paid: 0, preparing: 0, ready: 0, completed: 0 };
}
