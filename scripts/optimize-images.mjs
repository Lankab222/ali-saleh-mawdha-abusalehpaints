import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const settingsPath = path.join(root, "src/content/settings/site.json");
const sourceDir = path.join(root, "public/uploads");
const outputDir = path.join(root, "public/generated/images");
const manifestPath = path.join(root, "src/generated/image-manifest.json");

const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
const imageSettings = settings.imageProcessing ?? {};
const watermarkSettings = settings.watermark ?? {};

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

async function readPreviousManifest() {
  try { return JSON.parse(await fs.readFile(manifestPath, "utf8")); }
  catch { return { images: {} }; }
}
const previousManifest = await readPreviousManifest();

const emptyManifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  settings: {
    enabled: Boolean(imageSettings.enabled),
    watermarkEnabled: Boolean(watermarkSettings.enabled),
  },
  images: {},
};

if (!imageSettings.enabled) {
  await fs.writeFile(manifestPath, JSON.stringify(emptyManifest, null, 2));
  console.log("[images] Image processing disabled; wrote empty manifest.");
  process.exit(0);
}

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch (error) {
  console.error("[images] Sharp is required for image optimization. Run npm install first.");
  throw error;
}

const supported = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const excludedNames = new Set(["favicon.png", "favicon.jpg", "favicon.webp"]);
const widths = [...new Set((imageSettings.widths ?? [480, 768, 1200, 1600]).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
const webpQuality = Number(imageSettings.webpQuality ?? 82);
const avifQuality = Number(imageSettings.avifQuality ?? 58);
const warnAboveBytes = Number(imageSettings.warnAboveKb ?? 500) * 1024;
const processUnreferenced = Boolean(imageSettings.processUnreferenced ?? false);

function slugFor(relativePath) {
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 54) || "image";
  const hash = crypto.createHash("sha1").update(relativePath).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

function publicPath(filePath) {
  return `/${path.relative(path.join(root, "public"), filePath).split(path.sep).join("/")}`;
}

function localPath(publicUrl) {
  return path.join(root, "public", String(publicUrl).replace(/^\/+/, ""));
}

async function listFiles(dir) {
  const out = [];
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await listFiles(full));
      else out.push(full);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return out;
}

async function variantsExist(entry) {
  const variants = [...(entry?.plain ?? []), ...(entry?.watermarked ?? [])];
  if (!variants.length) return false;
  for (const variant of variants) {
    try { await fs.access(localPath(variant.src)); }
    catch { return false; }
  }
  return true;
}

async function collectUploadReferences() {
  const references = new Set();
  const roots = [path.join(root, "src"), path.join(root, "public/admin")];
  const textExtensions = new Set([".astro", ".ts", ".js", ".mjs", ".json", ".md", ".mdx", ".yml", ".yaml", ".html", ".css"]);
  const pattern = /\/uploads\/[^"'\n\r)>\]]+?\.(?:jpe?g|png|webp|avif)/giu;
  for (const scanRoot of roots) {
    for (const file of await listFiles(scanRoot)) {
      if (file.startsWith(path.join(root, "src/generated"))) continue;
      if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
      let source = "";
      try { source = await fs.readFile(file, "utf8"); } catch { continue; }
      for (const match of source.matchAll(pattern)) references.add(match[0]);
    }
  }
  return references;
}

async function createWatermarkSvg(logoPath, targetWidth, targetHeight) {
  const logo = sharp(logoPath, { failOn: "none" });
  const meta = await logo.metadata();
  if (!meta.width || !meta.height) return null;
  const desiredWidth = Math.max(40, Math.round(targetWidth * (Number(watermarkSettings.sizePercent ?? 14) / 100)));
  const ratio = meta.height / meta.width;
  const desiredHeight = Math.max(20, Math.round(desiredWidth * ratio));
  const logoBuffer = await logo.resize({ width: desiredWidth, height: desiredHeight, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const b64 = logoBuffer.toString("base64");
  const opacity = Math.max(0.05, Math.min(1, Number(watermarkSettings.opacity ?? 0.5)));
  const padding = Math.max(0, Number(watermarkSettings.padding ?? 24));
  const position = watermarkSettings.position ?? "bottom-right";
  const x = position.includes("left") ? padding : position.includes("right") ? Math.max(padding, targetWidth - desiredWidth - padding) : Math.max(0, Math.round((targetWidth - desiredWidth) / 2));
  const y = position.includes("top") ? padding : position.includes("bottom") ? Math.max(padding, targetHeight - desiredHeight - padding) : Math.max(0, Math.round((targetHeight - desiredHeight) / 2));
  const svg = `<svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${b64}" x="${x}" y="${y}" width="${desiredWidth}" height="${desiredHeight}" opacity="${opacity}"/></svg>`;
  return Buffer.from(svg);
}

const logoPublic = watermarkSettings.logo || settings.logo;
const logoPath = logoPublic?.startsWith("/") ? path.join(root, "public", logoPublic.slice(1)) : null;
let logoExists = false;
let logoStamp = "no-logo";
if (logoPath) {
  try {
    const stat = await fs.stat(logoPath);
    logoExists = true;
    logoStamp = `${stat.size}:${Math.round(stat.mtimeMs)}`;
  } catch {}
}

const processingStamp = crypto.createHash("sha1").update(JSON.stringify({
  widths,
  webpQuality,
  avifQuality,
  warnAboveKb: Number(imageSettings.warnAboveKb ?? 500),
  processUnreferenced,
  watermark: {
    enabled: Boolean(watermarkSettings.enabled),
    logo: logoPublic,
    logoStamp,
    position: watermarkSettings.position,
    opacity: watermarkSettings.opacity,
    sizePercent: watermarkSettings.sizePercent,
    padding: watermarkSettings.padding,
    applyTo: watermarkSettings.applyTo,
  },
})).digest("hex").slice(0, 16);

const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  processingStamp,
  settings: {
    enabled: true,
    widths,
    webpQuality,
    avifQuality,
    warnAboveKb: Number(imageSettings.warnAboveKb ?? 500),
    processUnreferenced,
    watermarkEnabled: Boolean(watermarkSettings.enabled && logoExists),
    watermarkLogo: logoExists ? logoPublic : null,
    watermarkApplyTo: watermarkSettings.applyTo ?? [],
  },
  images: {},
};

const allFiles = (await listFiles(sourceDir)).filter((file) => supported.has(path.extname(file).toLowerCase()));
const referencedUploads = await collectUploadReferences();
if (logoPublic) referencedUploads.add(logoPublic);
const allSources = allFiles.map((file) => `/uploads/${path.relative(sourceDir, file).split(path.sep).join("/")}`);
const unreferenced = allSources.filter((src) => !referencedUploads.has(src));
manifest.unreferenced = unreferenced;
const files = processUnreferenced
  ? allFiles
  : allFiles.filter((file) => referencedUploads.has(`/uploads/${path.relative(sourceDir, file).split(path.sep).join("/")}`));

let generatedCount = 0;
let reusedCount = 0;
console.log(`[images] ${referencedUploads.size} referenced upload paths; ${unreferenced.length} unreferenced files${processUnreferenced ? " (included by setting)" : " (skipped)"}.`);

for (const file of files) {
  const rel = path.relative(sourceDir, file).split(path.sep).join("/");
  const src = `/uploads/${rel}`;
  const stat = await fs.stat(file);
  const fingerprint = crypto.createHash("sha1").update(`${rel}|${stat.size}|${Math.round(stat.mtimeMs)}|${processingStamp}`).digest("hex");
  const previous = previousManifest.images?.[src];
  if (previous?.fingerprint === fingerprint && await variantsExist(previous)) {
    manifest.images[src] = previous;
    reusedCount += 1;
    console.log(`[images] reuse ${src}`);
    continue;
  }

  const metadata = await sharp(file, { failOn: "none" }).metadata();
  if (!metadata.width || !metadata.height) continue;

  const slug = slugFor(rel);
  const candidateWidths = widths.filter((w) => w < metadata.width);
  candidateWidths.push(metadata.width);
  const uniqueWidths = [...new Set(candidateWidths)].sort((a, b) => a - b);
  const entry = {
    src,
    fingerprint,
    originalBytes: stat.size,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    originalFormat: metadata.format,
    oversized: stat.size > warnAboveBytes,
    plain: [],
    watermarked: [],
  };

  const isLogo = logoPublic === src || excludedNames.has(path.basename(file).toLowerCase());
  const canWatermark = Boolean(watermarkSettings.enabled && logoExists && !isLogo);

  for (const width of uniqueWidths) {
    const height = Math.max(1, Math.round(metadata.height * (width / metadata.width)));
    const base = sharp(file, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true });
    for (const format of ["webp", "avif"]) {
      const outPath = path.join(outputDir, `${slug}-${width}.${format}`);
      const encoded = format === "webp" ? base.clone().webp({ quality: webpQuality }) : base.clone().avif({ quality: avifQuality, effort: 4 });
      await encoded.toFile(outPath);
      const outStat = await fs.stat(outPath);
      entry.plain.push({ src: publicPath(outPath), width, height, type: `image/${format}`, bytes: outStat.size });
    }

    if (canWatermark) {
      const watermarkSvg = await createWatermarkSvg(logoPath, width, height);
      if (watermarkSvg) {
        for (const format of ["webp", "avif"]) {
          const outPath = path.join(outputDir, `${slug}-${width}-wm.${format}`);
          let pipeline = sharp(file, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true }).composite([{ input: watermarkSvg }]);
          pipeline = format === "webp" ? pipeline.webp({ quality: webpQuality }) : pipeline.avif({ quality: avifQuality, effort: 4 });
          await pipeline.toFile(outPath);
          const outStat = await fs.stat(outPath);
          entry.watermarked.push({ src: publicPath(outPath), width, height, type: `image/${format}`, bytes: outStat.size });
        }
      }
    }
  }

  manifest.images[src] = entry;
  generatedCount += 1;
  const reduction = entry.plain.filter((v) => v.type === "image/webp").at(-1)?.bytes;
  const note = entry.oversized ? " ⚠ original is large" : "";
  console.log(`[images] build ${src} ${metadata.width}x${metadata.height} ${(stat.size / 1024).toFixed(0)}KB${note}${reduction ? ` -> webp ${(reduction / 1024).toFixed(0)}KB` : ""}`);
}

const referencedGenerated = new Set(Object.values(manifest.images).flatMap((entry) => [...(entry.plain ?? []), ...(entry.watermarked ?? [])].map((variant) => localPath(variant.src))));
for (const file of await listFiles(outputDir)) {
  if (!referencedGenerated.has(file)) await fs.rm(file, { force: true });
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[images] ${Object.keys(manifest.images).length} processed source images; generated ${generatedCount}, reused ${reusedCount}, skipped unreferenced ${processUnreferenced ? 0 : unreferenced.length}.`);
