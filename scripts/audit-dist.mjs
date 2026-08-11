import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const strict = process.argv.includes("--strict");

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

if (!(await exists(dist))) {
  console.error("[audit:dist] dist/ does not exist. Run npm run build first.");
  process.exit(1);
}

async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = await walk(dist);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const allRelative = new Set(files.map((file) => `/${path.relative(dist, file).split(path.sep).join("/")}`));

function routeFor(file) {
  const rel = path.relative(dist, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  if (rel.endsWith(".html")) return `/${rel.slice(0, -5)}`;
  return `/${rel}`;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
}

function firstMatch(html, regex) {
  const match = html.match(regex);
  return match?.[1] ? stripTags(match[1]) : "";
}

function attr(tag, name) {
  const regex = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "iu");
  const match = tag.match(regex);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function internalTargetExists(href, pageRoute) {
  if (!href || href.startsWith("#") || /^(?:mailto:|tel:|sms:|javascript:|data:)/iu.test(href)) return true;
  let url;
  try { url = new URL(href, `https://template.local${pageRoute}`); } catch { return true; }
  if (url.hostname !== "template.local") return true;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith("/admin/") || pathname.startsWith("/seo-admin/") || pathname.startsWith("/seo-api/")) return true;
  if (pathname === "/") return allRelative.has("/index.html");
  if (/\.[a-z0-9]{1,8}$/iu.test(pathname)) return allRelative.has(pathname);
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return allRelative.has(`${normalized}index.html`) || allRelative.has(`${pathname}.html`);
}

const issues = [];
let imageCount = 0;
let missingAltCount = 0;
let internalLinkCount = 0;
let brokenLinkCount = 0;

for (const file of htmlFiles) {
  const html = await fs.readFile(file, "utf8");
  const route = routeFor(file);
  const isUtility = route === "/404" || route === "/404/" || route.startsWith("/admin/") || route.startsWith("/seo-admin/");
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/iu);
  const descriptionTag = html.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/iu)?.[0] ?? html.match(/<meta\b[^>]*\bcontent=["'][^"']*["'][^>]*\bname=["']description["'][^>]*>/iu)?.[0] ?? "";
  const description = descriptionTag ? attr(descriptionTag, "content") || "" : "";
  const canonicalTag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/iu)?.[0] ?? "";
  const canonical = canonicalTag ? attr(canonicalTag, "href") || "" : "";
  const h1Count = (html.match(/<h1\b/giu) || []).length;

  if (!isUtility) {
    if (!title) issues.push({ level: "error", route, message: "missing <title>" });
    if (!description) issues.push({ level: "error", route, message: "missing meta description" });
    if (!canonical) issues.push({ level: "error", route, message: "missing canonical" });
    if (h1Count !== 1) issues.push({ level: "warning", route, message: `expected one H1, found ${h1Count}` });
  }

  for (const tag of html.match(/<img\b[^>]*>/giu) || []) {
    imageCount += 1;
    if (attr(tag, "alt") === null) {
      missingAltCount += 1;
      issues.push({ level: "error", route, message: "image without alt attribute" });
    }
    if (attr(tag, "width") === null || attr(tag, "height") === null) {
      issues.push({ level: "warning", route, message: "image without explicit width/height" });
    }
  }

  for (const tag of html.match(/<a\b[^>]*\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/giu) || []) {
    const href = attr(tag, "href");
    if (!href) continue;
    if (/^(?:https?:)?\/\//iu.test(href) || /^(?:mailto:|tel:|sms:|#)/iu.test(href)) continue;
    internalLinkCount += 1;
    if (!internalTargetExists(href, route)) {
      brokenLinkCount += 1;
      issues.push({ level: "error", route, message: `internal target not found: ${href}` });
    }
  }
}

const uniqueIssues = [...new Map(issues.map((item) => [`${item.level}|${item.route}|${item.message}`, item])).values()];
const errors = uniqueIssues.filter((item) => item.level === "error");
const warnings = uniqueIssues.filter((item) => item.level === "warning");

console.log(`[audit:dist] HTML pages: ${htmlFiles.length}`);
console.log(`[audit:dist] Images: ${imageCount}; missing alt: ${missingAltCount}`);
console.log(`[audit:dist] Internal links checked: ${internalLinkCount}; unresolved: ${brokenLinkCount}`);
for (const item of uniqueIssues.slice(0, 80)) {
  console.log(`${item.level === "error" ? "✗" : "!"} ${item.route} — ${item.message}`);
}
if (uniqueIssues.length > 80) console.log(`[audit:dist] +${uniqueIssues.length - 80} more issues omitted.`);
console.log(`[audit:dist] ${errors.length} errors, ${warnings.length} warnings.`);

if (errors.length || (strict && warnings.length)) process.exit(1);
