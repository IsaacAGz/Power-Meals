import type { KitchenTicket } from "./contract.ts";

export type Receipt = { text: string; escpos: Buffer };

const ESC = 0x1b;
const GS = 0x1d;
const INIT = Buffer.from([ESC, 0x40]);
const CODE_PAGE_1252 = Buffer.from([ESC, 0x74, 16]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 1]);
const BOLD_ON = Buffer.from([ESC, 0x45, 1]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0]);
const DOUBLE_SIZE = Buffer.from([GS, 0x21, 0x11]);
const NORMAL_SIZE = Buffer.from([GS, 0x21, 0x00]);
const FEED_AND_CUT = Buffer.from([ESC, 0x64, 4, GS, 0x56, 66, 0]);

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Tijuana",
});

const paymentLabels: Record<string, string> = {
  whatsapp: "Transferencia (WhatsApp)",
  openpay: "Tarjeta (Openpay)",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
}

/** Windows-1252 matches Latin-1 for every Spanish character; anything outside it prints as "?". */
function encode(text: string): Buffer {
  return Buffer.from(text.normalize("NFC").replace(/[^\u0000-\u00ff]/g, "?"), "latin1");
}

function wrap(text: string, width: number, indent = ""): string[] {
  const lines: string[] = [];
  let line = indent;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line.trim() && line.length + 1 + word.length > width) {
      lines.push(line);
      line = indent;
    }
    line += line.trim() ? ` ${word}` : word;
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = indent + line.slice(width);
    }
  }
  if (line.trim()) lines.push(line);
  return lines;
}

type Block = { text: string; style?: "bold" | "title" | "center" };

function blocks(ticket: KitchenTicket, width: number): Block[] {
  const rule: Block = { text: "-".repeat(width) };
  const out: Block[] = [
    { text: `PEDIDO #${ticket.orderNumber}`, style: "title" },
    { text: `Cocina ${ticket.facilityName}`, style: "center" },
    { text: dateFormat.format(new Date(ticket.paidAt ?? ticket.createdAt)), style: "center" },
    rule,
    { text: ticket.customerName, style: "bold" },
    { text: `Tel. ${ticket.customerPhone}` },
    ...wrap(`${ticket.fulfillment === "delivery" ? "Entrega" : "Recolección"}${ticket.place ? `: ${ticket.place}` : ""}`, width).map(
      (text) => ({ text }),
    ),
    ...(ticket.address ? wrap(ticket.address, width).map((text) => ({ text })) : []),
    rule,
  ];

  for (const line of ticket.lines) {
    out.push(...wrap(`${line.quantity} x ${line.name}`, width).map((text): Block => ({ text, style: "bold" })));
    if (line.detail) out.push(...wrap(line.detail, width, "  ").map((text) => ({ text })));
    for (const slot of line.slots) {
      out.push(...wrap(`- ${slot.name}`, width, "  ").map((text) => ({ text })));
      if (slot.detail) out.push(...wrap(slot.detail, width, "    ").map((text) => ({ text })));
    }
  }

  out.push(rule);
  if (ticket.notes) {
    out.push({ text: "NOTA:", style: "bold" }, ...wrap(ticket.notes, width).map((text) => ({ text })), rule);
  }
  out.push(
    { text: `Total: ${money(ticket.totalCents)}`, style: "bold" },
    { text: `Pago: ${paymentLabels[ticket.paymentMethod] ?? ticket.paymentMethod}` },
  );
  return out;
}

export function renderReceipt(ticket: KitchenTicket, width: number): Receipt {
  const parts: Buffer[] = [INIT, CODE_PAGE_1252];
  const text: string[] = [];
  for (const block of blocks(ticket, width)) {
    text.push(block.text);
    if (block.style === "title") {
      parts.push(ALIGN_CENTER, DOUBLE_SIZE, BOLD_ON, encode(block.text), Buffer.from("\n"), BOLD_OFF, NORMAL_SIZE, ALIGN_LEFT);
    } else if (block.style === "center") {
      parts.push(ALIGN_CENTER, encode(block.text), Buffer.from("\n"), ALIGN_LEFT);
    } else if (block.style === "bold") {
      parts.push(BOLD_ON, encode(block.text), Buffer.from("\n"), BOLD_OFF);
    } else {
      parts.push(encode(block.text), Buffer.from("\n"));
    }
  }
  parts.push(FEED_AND_CUT);
  return { text: `${text.join("\n")}\n`, escpos: Buffer.concat(parts) };
}

/** Rejects anything that is not a version 1 ticket, so a malformed message ends in the DLQ instead of printing. */
export function parseTicket(body: string | undefined): KitchenTicket {
  const ticket = JSON.parse(body ?? "") as Partial<KitchenTicket>;
  if (
    ticket.v !== 1 ||
    typeof ticket.orderId !== "string" ||
    typeof ticket.orderNumber !== "number" ||
    typeof ticket.kitchenFacilityId !== "string" ||
    !Array.isArray(ticket.lines)
  ) {
    throw new Error("Unsupported ticket payload");
  }
  return ticket as KitchenTicket;
}
