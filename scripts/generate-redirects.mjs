import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src/content/redirects/settings.json");
const outputPath = path.join(root, "public/_redirects");
const protectedLines = [
  "/contact /contact/ 301",
  "/services /services/ 301",
  "/projects /projects/ 301",
  "/blog /blog/ 301",
  "/about /about/ 301",
  "/seo-admin /seo-admin/ 301",
  "/admin /admin/ 301",
];

let redirects = [];
try {
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  redirects = Array.isArray(source.redirects) ? source.redirects : [];
} catch (error) {
  console.warn("تعذر قراءة إعدادات التحويلات:", error instanceof Error ? error.message : error);
}

const normalizePath = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const generated = redirects
  .filter((item) => item && item.enabled !== false)
  .map((item) => {
    const from = normalizePath(item.from);
    const to = normalizePath(item.to);
    const status = item.status === "302" ? "302" : "301";
    return from && to ? `${from} ${to} ${status}` : "";
  })
  .filter(Boolean);

const unique = [...new Set([...protectedLines, ...generated])];
fs.writeFileSync(outputPath, `${unique.join("\n")}\n`, "utf8");
console.log(`تم توليد ${unique.length} قاعدة تحويل في public/_redirects`);
