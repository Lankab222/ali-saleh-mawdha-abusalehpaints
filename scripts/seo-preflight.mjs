import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/content/settings/site.json",
  "src/content/seo-settings/settings.json",
  "src/pages/robots.txt.ts",
  "src/pages/seo-admin/index.astro",
  "public/_headers",
];
let failed = false;
for (const file of required) {
  const exists = fs.existsSync(path.join(root, file));
  console.log(`${exists ? "✓" : "✗"} ${file}`);
  if (!exists) failed = true;
}
const site = JSON.parse(fs.readFileSync(path.join(root, "src/content/settings/site.json"), "utf8"));
if (!/^https:\/\//iu.test(site.siteUrl) || /example\.com/iu.test(site.siteUrl)) {
  console.error("✗ siteUrl غير صالح أو ما زال تجريبيًا");
  failed = true;
} else {
  console.log(`✓ siteUrl: ${site.siteUrl}`);
}
if (failed) process.exit(1);
console.log("اكتمل فحص ما قبل النشر بنجاح.");
