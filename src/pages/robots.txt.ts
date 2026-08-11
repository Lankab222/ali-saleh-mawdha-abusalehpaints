import type { APIContext } from "astro";
import { getEntry } from "astro:content";

export const prerender = true;

export async function GET(context: APIContext) {
  const seoEntry = await getEntry("seoSettings", "settings");
  const settingsEntry = await getEntry("settings", "site");
  const fallbackSite = settingsEntry?.data.siteUrl || "https://example.com";
  const site = (context.site ?? new URL(fallbackSite)).toString().replace(/\/+$/, "");
  const disallow = seoEntry?.data.robots.disallow ?? ["/admin/", "/seo-admin/", "/seo-api/"];
  const lines = [
    "User-agent: *",
    seoEntry?.data.robots.allowAll === false ? "Disallow: /" : "Allow: /",
    ...disallow.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${site}/sitemap-index.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
