import { formatMXN } from "./menu-data";

export const WHATSAPP_NUMBER = "16196001137";
export const WHATSAPP_DISPLAY = "+1 619 600 1137";

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export type OrderLine = { name: string; price: number; quantity: number };

export type OrderSummary = {
  nombre: string;
  telefono: string;
  metodo: "entrega" | "recoleccion";
  zona?: string;
  direccion?: string;
  punto?: string;
  lineas: OrderLine[];
  notas?: string;
};

export function orderTotal(lines: OrderLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function buildOrderMessage(order: OrderSummary) {
  const lines = order.lineas.map(
    (line) =>
      `- ${line.quantity} x ${line.name} (${formatMXN(line.price)} c/u) = ${formatMXN(line.price * line.quantity)}`,
  );

  const entrega =
    order.metodo === "entrega"
      ? [`Método: Entrega a domicilio`, `Zona: ${order.zona ?? ""}`, `Dirección: ${order.direccion ?? ""}`]
      : [`Método: Recolección`, `Punto: ${order.punto ?? ""}`];

  return [
    "Hola Power Meals, quiero hacer un pedido.",
    "",
    `Nombre: ${order.nombre}`,
    `Teléfono: ${order.telefono}`,
    ...entrega,
    "",
    "Pedido:",
    ...lines,
    `Total estimado: ${formatMXN(orderTotal(order.lineas))} MXN`,
    ...(order.notas ? ["", `Notas: ${order.notas}`] : []),
    "",
    "Quedo en espera de los datos para pagar por transferencia bancaria.",
  ].join("\n");
}

export const GENERAL_MESSAGE = "Hola Power Meals, tengo una pregunta.";
export const ZONE_QUESTION_MESSAGE = "Hola Power Meals, ¿entregan en mi zona? Mi colonia es: ";
export const PARTNER_MESSAGE = "Hola Power Meals, me interesa ser partner. Mi negocio es: ";
