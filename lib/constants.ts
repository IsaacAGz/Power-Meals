export const BRAND = {
  name: "Power Meals",
  tagline: "Comida real. Energía real. Resultados reales.",
  whatsappE164: "16196001137",
  whatsappDisplay: "+1 619 600 1137",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/menu", label: "Menú y precios" },
  { href: "/ubicaciones", label: "Ubicaciones" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/pedido", label: "Pedir" },
] as const;

/**
 * Who answers for customer data in the Aviso de privacidad (/aviso-de-privacidad). The bracketed values must be
 * replaced with the legal name and address before launch; the mailbox must exist and be read.
 */
export const PRIVACY = {
  controller: "[Nombre completo o razón social del responsable]",
  address: "[Domicilio completo: calle, número, colonia, C.P., Tijuana, Baja California]",
  email: "privacidad@powermealstj.com",
  updatedAt: "9 de noviembre de 2026",
} as const;
