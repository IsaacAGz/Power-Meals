/** Public pages, for the sitemap. Account, kitchen, checkout-return and token pages are left out (app/robots.ts). */
export const PUBLIC_PAGES = ["/", "/menu", "/pedido", "/ubicaciones", "/nosotros", "/proyectos", "/aviso-de-privacidad"] as const;

/** Paths crawlers should skip: private or session-bound pages, token links, and the API. */
export const CRAWL_DISALLOW = [
  "/api/",
  "/kitchen",
  "/cuenta",
  "/historial",
  "/ingresar",
  "/registro",
  "/recuperar",
  "/verificar",
  "/pedido/success",
  "/pedido/cancel",
] as const;

/**
 * Canonical origin for metadata, robots and the sitemap. Production builds require NEXT_PUBLIC_SITE_URL
 * (scripts/check-deploy-env.mjs); the fallback only keeps local builds without a .env working.
 */
export function publicSiteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
}
