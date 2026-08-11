import fs from "node:fs";
import path from "node:path";

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve("src/generated/image-manifest.json"), "utf8"));
  } catch {
    return { settings: {}, images: {} };
  }
}

const makeSrcSet = (items) => items.map((item) => `${item.src} ${item.width}w`).join(", ");

export default function rehypeResponsiveImages() {
  const manifest = loadManifest();
  const watermarkEnabled = Boolean(manifest.settings?.watermarkEnabled);
  const applyTo = manifest.settings?.watermarkApplyTo ?? [];

  return (tree) => {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;

      if (node.type === "element" && node.tagName === "img") {
        const props = node.properties ?? (node.properties = {});
        const originalSrc = typeof props.src === "string" ? props.src : "";
        const entry = manifest.images?.[originalSrc];
        props.loading ??= "lazy";
        props.decoding ??= "async";

        if (entry) {
          const variants = watermarkEnabled && applyTo.includes("content") && entry.watermarked?.length
            ? entry.watermarked
            : entry.plain ?? [];
          const webp = variants.filter((item) => item.type === "image/webp").sort((a, b) => a.width - b.width);
          const avif = variants.filter((item) => item.type === "image/avif").sort((a, b) => a.width - b.width);
          const sizes = props.sizes ?? "(min-width: 900px) 760px, calc(100vw - 2rem)";
          const imgProperties = {
            ...props,
            src: originalSrc,
            width: props.width ?? entry.originalWidth,
            height: props.height ?? entry.originalHeight,
            loading: props.loading ?? "lazy",
            decoding: props.decoding ?? "async",
          };
          delete imgProperties.srcSet;
          delete imgProperties.sizes;

          node.tagName = "picture";
          node.properties = { className: ["content-picture"] };
          node.children = [
            ...(avif.length ? [{ type: "element", tagName: "source", properties: { type: "image/avif", srcSet: makeSrcSet(avif), sizes }, children: [] }] : []),
            ...(webp.length ? [{ type: "element", tagName: "source", properties: { type: "image/webp", srcSet: makeSrcSet(webp), sizes }, children: [] }] : []),
            { type: "element", tagName: "img", properties: imgProperties, children: [] },
          ];
          return;
        }
      }

      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}
