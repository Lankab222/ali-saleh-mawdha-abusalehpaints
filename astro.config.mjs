// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import path from "node:path";
import rehypeResponsiveImages from "./src/lib/images/rehype-responsive-images.mjs";

const root = process.cwd();

function loadJson(relative, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8")); }
  catch { return fallback; }
}

const siteSettings = loadJson("src/content/settings/site.json", { siteUrl: "https://example.com" });
const site = process.env.PUBLIC_SITE_URL || siteSettings.siteUrl || "https://example.com";
const seoSettings = loadJson("src/content/seo-settings/settings.json", {
  noindexTagPages: true,
  noindexCategoryPages: true,
});

function collectNoindexContentPaths() {
  const entries = [
    ["src/content/blog", "/blog/"],
    ["src/content/services", "/services/"],
    ["src/content/projects", "/projects/"],
  ];
  const excluded = new Set();
  for (const [relativeDir, routeBase] of entries) {
    const directory = path.join(root, relativeDir);
    if (!fs.existsSync(directory)) continue;
    for (const fileName of fs.readdirSync(directory)) {
      if (!/\.(md|mdx)$/iu.test(fileName)) continue;
      const source = fs.readFileSync(path.join(directory, fileName), "utf8");
      if (!/^noindex:\s*true\s*$/imu.test(source)) continue;
      excluded.add(`${routeBase}${fileName.replace(/\.(md|mdx)$/iu, "")}/`);
    }
  }
  return excluded;
}

const noindexContentPaths = collectNoindexContentPaths();

export default defineConfig({
  site,
  trailingSlash: "always",
  compressHTML: true,
  build: { format: "directory" },
  markdown: { rehypePlugins: [rehypeResponsiveImages] },
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        if (["/admin/", "/seo-admin/", "/seo-api/"].some((prefix) => pathname.startsWith(prefix))) return false;
        if (seoSettings.noindexTagPages && pathname.startsWith("/blog/tag/")) return false;
        if (seoSettings.noindexCategoryPages && pathname.startsWith("/blog/category/")) return false;
        return !noindexContentPaths.has(pathname);
      },
    }),
  ],
});
