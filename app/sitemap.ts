import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, publicSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  return PUBLIC_PAGES.map((path) => ({
    url: new URL(path, base).href,
    changeFrequency: path === "/menu" || path === "/pedido" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/menu" || path === "/pedido" ? 0.8 : 0.5,
  }));
}
