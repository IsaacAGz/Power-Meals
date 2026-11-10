import type { MetadataRoute } from "next";
import { CRAWL_DISALLOW, publicSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...CRAWL_DISALLOW] },
    sitemap: new URL("/sitemap.xml", publicSiteUrl()).href,
  };
}
