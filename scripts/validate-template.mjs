import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sitePath = path.join(root, "src/content/settings/site.json");
const seoPath = path.join(root, "src/content/seo-settings/settings.json");
const manifestPath = path.join(root, "src/generated/image-manifest.json");
const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
const seo = JSON.parse(fs.readFileSync(seoPath, "utf8"));
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { images: {} };

const errors = [];
const warnings = [];
const ok = [];
const add = (condition, success, failure, level = "error") => {
  if (condition) ok.push(success);
  else (level === "warning" ? warnings : errors).push(failure);
};
const uploadExists = (value) => {
  if (!value || !String(value).startsWith("/uploads/")) return true;
  return fs.existsSync(path.join(root, "public", String(value).replace(/^\/+/, "")));
};

add(/^https:\/\//i.test(site.siteUrl), `HTTPS siteUrl: ${site.siteUrl}`, "siteUrl must use https://");
add(!/example\.com/i.test(site.siteUrl), "Production domain configured", "siteUrl still uses example.com");
add(Boolean(site.siteName?.trim()), "Site name configured", "siteName is empty");
add(Boolean(site.city?.trim()), "City configured", "city is empty");
add(Boolean(site.logo), "Logo configured", "Logo is missing", "warning");
add(Boolean(site.heroImage), "Hero image configured", "Hero image is missing", "warning");
add(Boolean(site.heroImageAlt?.trim()), "Hero ALT configured", "Hero image ALT is missing", "warning");
add(uploadExists(site.logo), "Logo file exists", `Logo file not found: ${site.logo || "(empty)"}`, "warning");
add(uploadExists(site.heroImage), "Hero image file exists", `Hero image file not found: ${site.heroImage || "(empty)"}`, "warning");
add(uploadExists(site.defaultImage), "Default image file exists", `Default image file not found: ${site.defaultImage || "(empty)"}`, "warning");
add(Boolean(seo.titleTemplate?.includes("%s")), "SEO title template includes %s", "SEO titleTemplate should include %s", "warning");
add(Boolean(seo.robots?.allowAll), "Robots allow crawling", "robots.allowAll is false — whole site will be blocked");

const expectedHost = new URL(site.siteUrl).hostname.replace(/^www\./i, "");
if (seo.searchConsoleProperty) {
  add(seo.searchConsoleProperty.includes(expectedHost), "Search Console property matches domain", `Search Console property does not match ${expectedHost}`, "warning");
}

const contentDirs = ["blog", "services", "projects"];
for (const dir of contentDirs) {
  const full = path.join(root, "src/content", dir);
  if (!fs.existsSync(full)) continue;
  for (const file of fs.readdirSync(full).filter((x) => /\.mdx?$/i.test(x))) {
    const source = fs.readFileSync(path.join(full, file), "utf8");
    const title = source.match(/^title:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim() || "";
    const desc = source.match(/^description:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim() || "";
    const image = source.match(/^image:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim();
    const imageAlt = source.match(/^imageAlt:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim();
    const coverImage = source.match(/^coverImage:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim();
    const coverImageAlt = source.match(/^coverImageAlt:\s*["']?(.*?)["']?\s*$/mi)?.[1]?.trim();
    if (!title) errors.push(`${dir}/${file}: missing title`);
    if (!desc) warnings.push(`${dir}/${file}: missing description`);
    if (image && !imageAlt) warnings.push(`${dir}/${file}: image exists but imageAlt is missing`);
    if (coverImage && !coverImageAlt) warnings.push(`${dir}/${file}: coverImage exists but coverImageAlt is missing`);
    if (image && !uploadExists(image)) errors.push(`${dir}/${file}: image file not found: ${image}`);
    if (coverImage && !uploadExists(coverImage)) errors.push(`${dir}/${file}: coverImage file not found: ${coverImage}`);
  }
}

for (const [src, entry] of Object.entries(manifest.images || {})) {
  if (entry.oversized) warnings.push(`${src}: original image is ${(entry.originalBytes / 1024).toFixed(0)}KB`);
}

const requiredFiles = [
  "src/pages/robots.txt.ts",
  "public/_headers",
  "public/admin/index.html",
  "public/admin/config.yml",
  "src/pages/seo-admin/index.astro",
  "src/components/common/SmartImage.astro",
  "scripts/optimize-images.mjs",
  "scripts/client-setup.mjs",
  "scripts/client-init.mjs",
  "scripts/audit-dist.mjs",
  "client.config.example.json",
];
for (const rel of requiredFiles) add(fs.existsSync(path.join(root, rel)), `${rel} exists`, `${rel} is missing`);

for (const item of ok) console.log(`✓ ${item}`);
for (const item of warnings) console.warn(`⚠ ${item}`);
for (const item of errors) console.error(`✗ ${item}`);
console.log(`\nValidation: ${errors.length} errors, ${warnings.length} warnings.`);
if (errors.length) process.exit(1);
