import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const site = JSON.parse(await fs.readFile(path.join(root, "src/content/settings/site.json"), "utf8"));
const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.error("[indexnow] Missing INDEXNOW_KEY. Create a key and expose it as an environment secret.");
  process.exit(1);
}

const siteUrl = site.siteUrl.replace(/\/+$/, "");
const host = new URL(siteUrl).hostname;
const keyFile = path.join(root, "public", `${key}.txt`);
await fs.writeFile(keyFile, key, "utf8");

const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
let urls = args.map((value) => new URL(value, `${siteUrl}/`).toString());
if (!urls.length) {
  urls = [`${siteUrl}/`, `${siteUrl}/services/`, `${siteUrl}/blog/`, `${siteUrl}/projects/`];
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${siteUrl}/${key}.txt`,
    urlList: urls,
  }),
});

if (!response.ok && response.status !== 202) {
  console.error(`[indexnow] Failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}
console.log(`[indexnow] Submitted ${urls.length} URL(s). HTTP ${response.status}.`);
