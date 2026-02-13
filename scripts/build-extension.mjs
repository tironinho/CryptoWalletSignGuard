/**
 * Assembles extension/ for "Load unpacked":
 * - dist/* -> extension/* (flatten; no extension/dist)
 * - manifest from src/manifest.template.json -> extension/manifest.json
 * - dist/_locales -> extension/_locales (included in copyDir dist->extension)
 * Validates required files and manifest JSON. Fails build if anything is missing.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const EXTENSION = path.join(ROOT, "extension");
const MANIFEST_TEMPLATE = path.join(SRC, "manifest.template.json");

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(dstDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 1) Clean extension
rimraf(EXTENSION);
ensureDir(EXTENSION);

// 2) Copy dist/* -> extension/* (flatten)
if (!fs.existsSync(DIST)) {
  console.error("build-extension: dist/ not found. Run the main build first.");
  process.exit(1);
}
copyDir(DIST, EXTENSION);

// 3) extension/manifest.json (from template; template has flat paths)
if (!fs.existsSync(MANIFEST_TEMPLATE)) {
  console.error("build-extension: src/manifest.template.json not found.");
  process.exit(1);
}
let manifestRaw;
try {
  manifestRaw = fs.readFileSync(MANIFEST_TEMPLATE, "utf8");
} catch (e) {
  console.error("build-extension: failed to read manifest template:", (e && e.message) || e);
  process.exit(1);
}
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (e) {
  console.error("build-extension: src/manifest.template.json is invalid JSON:", (e && e.message) || e);
  process.exit(1);
}
const extManifestPath = path.join(EXTENSION, "manifest.json");
fs.writeFileSync(extManifestPath, JSON.stringify(manifest, null, 0), "utf8");

// 4) _locales: already in dist (build.mjs copies root _locales -> dist). copyDir(dist, extension) put extension/_locales.
//    If dist has no _locales, copy from root as fallback.
const extLocales = path.join(EXTENSION, "_locales");
if (!fs.existsSync(extLocales) && fs.existsSync(path.join(ROOT, "_locales"))) {
  copyDir(path.join(ROOT, "_locales"), extLocales);
}

// 5) Validate required files
const requiredFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "mainWorld.js",
  "popup.html",
  "options.html",
  "overlay.css",
];
const missing = requiredFiles.filter((name) => !fs.existsSync(path.join(EXTENSION, name)));
if (missing.length) {
  console.error("build-extension: missing in extension/:", missing.join(", "));
  process.exit(1);
}
const iconsDir = path.join(EXTENSION, "icons");
if (!fs.existsSync(iconsDir) || !fs.readdirSync(iconsDir).length) {
  console.error("build-extension: extension/icons/ missing or empty.");
  process.exit(1);
}

// 6) Validate extension/manifest.json is valid JSON
try {
  JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
} catch (e) {
  console.error("build-extension: extension/manifest.json is invalid JSON:", (e && e.message) || e);
  process.exit(1);
}

console.log("Extension folder ready:", EXTENSION);
console.log("Load unpacked: select the ./extension folder in chrome://extensions");
