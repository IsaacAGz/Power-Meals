import { loadPrinterConfig } from "./config.ts";
import type { KitchenTicket } from "./contract.ts";
import { print } from "./printer.ts";
import { renderReceipt } from "./receipt.ts";

/** Prints a sample ticket to PRINTER_TARGET without touching SQS, to check the printer during setup. */
const config = loadPrinterConfig();
const now = new Date().toISOString();
const sample: KitchenTicket = {
  v: 1,
  orderId: "00000000-0000-0000-0000-000000000000",
  orderNumber: 0,
  kitchenFacilityId: "00000000-0000-0000-0000-000000000000",
  facilityName: "Prueba",
  paymentMethod: "whatsapp",
  createdAt: now,
  paidAt: now,
  customerName: "Prueba de impresión",
  customerPhone: "664 000 0000",
  fulfillment: "pickup",
  place: "Punto de prueba",
  address: "Paseo de los Héroes, Zona Río",
  notes: "Ticket de prueba: acentos á é í ó ú ñ ¿ ¡",
  totalCents: 13900,
  lines: [
    {
      name: "Pollo + arroz + veggies · Regular",
      quantity: 1,
      detail: "130 g proteína · 130 g carbohidrato · 100 g vegetales · Balanceado · Salsa roja 1 oz",
      slots: [],
    },
  ],
};

await print(renderReceipt(sample, config.printerColumns), {
  target: config.printerTarget,
  timeoutMs: config.printerTimeoutMs,
  checkPaperStatus: config.checkPaperStatus,
});
console.info(`Sample ticket sent to ${config.printerTarget}`);
