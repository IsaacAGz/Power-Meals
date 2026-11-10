import { expect, test } from "@playwright/test";

// Playwright's server runs with NEXT_PUBLIC_SITE_URL=http://localhost:3100 (playwright.config.ts).
const SITE = "http://localhost:3100";

test("robots.txt keeps crawlers out of private pages and points at the sitemap", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Allow: /");
  for (const path of ["/api/", "/kitchen", "/cuenta", "/pedido/success", "/verificar"]) expect(body).toContain(`Disallow: ${path}`);
  expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("the sitemap lists the public pages only", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  expect(body).toContain(`<loc>${SITE}/menu</loc>`);
  expect(body).toContain(`<loc>${SITE}/aviso-de-privacidad</loc>`);
  expect(body).not.toContain("/cuenta");
  expect(body).not.toContain("/kitchen");
});

test("pages carry an absolute preview image and their own canonical URL", async ({ page }) => {
  await page.goto("/menu?utm_source=whatsapp");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}/menu`);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(new RegExp(`^${SITE}/opengraph-image\\.jpg`));
  expect((await page.request.get(image!)).headers()["content-type"]).toBe("image/jpeg");

  await page.goto("/verificar");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
