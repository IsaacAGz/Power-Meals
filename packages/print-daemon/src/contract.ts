/** The SQS message body the web app publishes and the print daemon consumes. Bump `v` on breaking changes. */
export type KitchenTicket = {
  v: 1;
  orderId: string;
  orderNumber: number;
  kitchenFacilityId: string;
  facilityName: string;
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
  customerName: string;
  customerPhone: string;
  fulfillment: "delivery" | "pickup";
  place: string;
  address: string | null;
  notes: string | null;
  totalCents: number;
  lines: { name: string; quantity: number; detail: string; slots: { name: string; detail: string }[] }[];
};

export const FACILITY_ATTRIBUTE = "kitchen_facility_id";
export const ORDER_ATTRIBUTE = "order_id";
