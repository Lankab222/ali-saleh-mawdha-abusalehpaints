import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const argIndex = process.argv.indexOf("--config");
const configPath = path.resolve(root, argIndex >= 0 ? process.argv[argIndex + 1] : "client.config.json");

let client;
try { client = JSON.parse(await fs.readFile(configPath, "utf8")); }
catch {
  console.error(`[client] Missing ${path.relative(root, configPath)}. Copy client.config.example.json to client.config.json first.`);
  process.exit(1);
}

const sitePath = path.join(root, "src/content/settings/site.json");
const seoPath = path.join(root, "src/content/seo-settings/settings.json");
const adminPath = path.join(root, "public/admin/config.yml");
const site = JSON.parse(await fs.readFile(sitePath, "utf8"));
const seo = JSON.parse(await fs.readFile(seoPath, "utf8"));
const previous = {
  siteName: site.siteName,
  siteUrl: site.siteUrl,
  host: new URL(site.siteUrl).hostname,
  city: site.city,
  region: site.region,
  country: site.country,
  locale: site.locale,
  businessType: site.businessType,
  primaryColor: site.primaryColor,
  phone: site.phone,
  phoneDisplay: site.phoneDisplay,
  whatsapp: site.whatsapp,
};

const required = ["siteName", "siteUrl", "city"];
for (const key of required) {
  if (!client[key]) throw new Error(`[client] ${key} is required.`);
}
new URL(client.siteUrl);

Object.assign(site, {
  siteName: client.siteName,
  siteTitle: client.siteTitle || `${client.siteName} | ${client.city}`,
  description: client.description || site.description,
  siteUrl: client.siteUrl.replace(/\/+$/, ""),
  city: client.city,
  region: client.region ?? site.region,
  country: client.country ?? site.country,
  locale: client.locale ?? site.locale ?? "ar-SA",
  businessType: client.businessType ?? site.businessType ?? "LocalBusiness",
  serviceAreas: client.serviceAreas ?? [client.city],
  openingHours: client.openingHours ?? site.openingHours,
  priceRange: client.priceRange ?? site.priceRange,
  phone: client.phone ?? site.phone,
  phoneDisplay: client.phoneDisplay ?? client.phone ?? site.phoneDisplay,
  whatsapp: client.whatsapp ?? site.whatsapp,
  email: client.email ?? "",
  address: client.address ?? `${client.city}`,
  googleBusinessProfileUrl: client.googleBusinessProfileUrl ?? "",
  facebook: client.facebook ?? "",
  instagram: client.instagram ?? "",
  x: client.x ?? "",
  youtube: client.youtube ?? "",
  primaryColor: client.primaryColor ?? site.primaryColor,
});
if (Array.isArray(site.heroPoints)) {
  site.heroPoints = site.heroPoints.map((x) => String(x).replaceAll(previous.city, client.city));
}

const hostname = new URL(site.siteUrl).hostname;
const searchConsoleHostname = hostname.replace(/^www\./iu, "");
seo.titleTemplate = `%s | ${client.siteName}`;
seo.defaultDescription = client.description || site.description;
seo.searchConsoleProperty = `sc-domain:${searchConsoleHostname}`;
seo.googleSiteVerification = "";
seo.bingSiteVerification = "";
seo.googleBusinessProfileUrl = client.googleBusinessProfileUrl ?? "";

await fs.writeFile(sitePath, JSON.stringify(site, null, 2) + "\n");
await fs.writeFile(seoPath, JSON.stringify(seo, null, 2) + "\n");

const replacements = new Map([
  [previous.siteUrl, site.siteUrl],
  [previous.host, hostname],
  [previous.siteName, client.siteName],
  [previous.city, client.city],
  [previous.region, site.region],
  [previous.country, site.country],
  [previous.locale, site.locale],
  [previous.businessType, site.businessType],
  [previous.primaryColor, site.primaryColor],
  [previous.phoneDisplay, site.phoneDisplay],
  [previous.phone, site.phone],
  [previous.whatsapp, site.whatsapp],
].filter(([a, b]) => a && b && a !== b));

const textExtensions = new Set([".astro", ".ts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".toml", ".txt", ".html", ".css", ".example"]);
const skipDirs = new Set(["node_modules", "dist", ".astro", ".git", "uploads", "generated", "fonts"]);
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name === ".env.example") files.push(full);
  }
  return files;
}
for (const file of await walk(root)) {
  if (file === configPath) continue;
  let text = await fs.readFile(file, "utf8");
  const before = text;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  if (text !== before) await fs.writeFile(file, text);
}

let admin = await fs.readFile(adminPath, "utf8");
if (client.repo) admin = admin.replace(/^\s*repo:\s*.*$/m, `  repo: ${client.repo}`);
if (client.oauthBaseUrl) admin = admin.replace(/^\s*base_url:\s*.*$/m, `  base_url: ${client.oauthBaseUrl.replace(/\/+$/, "")}`);
await fs.writeFile(adminPath, admin);

console.log("[client] Client configuration applied.");
console.log(`[client] Site: ${site.siteName} — ${site.siteUrl}`);
console.log("[client] Next: replace images, review content, run npm run validate, then npm run build.");
