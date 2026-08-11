import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "client.config.example.json");
const target = path.join(root, "client.config.json");

try {
  await fs.access(target);
  console.log("[client] client.config.json already exists. Nothing changed.");
  process.exit(0);
} catch {}

await fs.copyFile(source, target);
console.log("[client] Created client.config.json from the example.");
console.log("[client] Edit it, then run: npm run client:setup");
