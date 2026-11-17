import "server-only";
import { sendEmail } from "@/lib/email";
import { CONTACT_KIND_LABEL, type ContactRequest } from "./validation";

/** Inbox for partner and catering requests. Sending also needs ORDER_EMAIL_FROM (the SES sender). */
function contactInbox(): string {
  return process.env.CONTACT_EMAIL_TO?.trim() ?? "";
}

export function isContactConfigured(): boolean {
  return Boolean(contactInbox() && process.env.ORDER_EMAIL_FROM?.trim());
}

const PEOPLE_LABEL = { gimnasio: "Socios", oficina: "Colaboradores", catering: "Invitados" } as const;

export function contactEmailText(request: ContactRequest): string {
  const lines = [
    `Nueva solicitud desde powermeals: ${CONTACT_KIND_LABEL[request.tipo]}`,
    "",
    `Nombre: ${request.nombre}`,
    `Negocio / evento: ${request.empresa}`,
    `Correo: ${request.email}`,
    `Teléfono: ${request.telefono}`,
    `${PEOPLE_LABEL[request.tipo]}: ${request.personas ?? "—"}`,
  ];
  if (request.tipo !== "catering") lines.push(`Necesita refrigerador: ${request.refrigerador ? "Sí" : "No"}`);
  lines.push("", "Mensaje:", request.mensaje || "—", "", "Responde a este correo para contestarle directamente.");
  return lines.join("\n");
}

export async function sendContactRequest(request: ContactRequest): Promise<void> {
  const to = contactInbox();
  if (!to) throw new Error("CONTACT_EMAIL_TO is not set");
  await sendEmail({
    to,
    replyTo: request.email,
    subject: `Solicitud de ${CONTACT_KIND_LABEL[request.tipo].toLowerCase()}: ${request.empresa}`,
    text: contactEmailText(request),
  });
}
