/**
 * Assembles extension/ for "Load unpacked":
 * - dist/** -> extension/** (bundles at extension root)
 * - manifest.json -> extension/manifest.json (paths rewritten: dist/ -> removed)
 * - _locales/** -> extension/_locales/**
 * Fails if extension/manifest.json is missing or invalid.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, "dist");
const EXTENSION = path.join(ROOT, "extension");
const MANIFEST_SRC = path.join(ROOT, "manifest.json");
const LOCALES_SRC = path.join(ROOT, "_locales");

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

/** Recursively strip "dist/" prefix from string values so extension root = bundle root. */
function stripDistPaths(obj) {
  if (typeof obj === "string" && obj.startsWith("dist/")) return obj.slice(5);
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => stripDistPaths(item));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.startsWith("dist/")) {
      out[k] = v.slice(5);
    } else if (typeof v === "object" && v !== null) {
      out[k] = stripDistPaths(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// 1) Clean extension
rimraf(EXTENSION);
ensureDir(EXTENSION);

// 2) Copy dist/** -> extension/**
if (!fs.existsSync(DIST)) {
  console.error("build-extension: dist/ not found. Run the main build first.");
  process.exit(1);
}
copyDir(DIST, EXTENSION);

// 3) Manifest: copy and rewrite paths (dist/ -> removed)
if (!fs.existsSync(MANIFEST_SRC)) {
  console.error("build-extension: manifest.json not found in project root.");
  process.exit(1);
}
const manifestRaw = fs.readFileSync(MANIFEST_SRC, "utf8");
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (e) {
  console.error("build-extension: invalid JSON in manifest.json:", (e && e.message) || e);
  process.exit(1);
}
const manifestForExtension = stripDistPaths(manifest);
fs.writeFileSync(
  path.join(EXTENSION, "manifest.json"),
  JSON.stringify(manifestForExtension, null, 0),
  "utf8"
);

// 4) _locales
if (fs.existsSync(LOCALES_SRC)) {
  copyDir(LOCALES_SRC, path.join(EXTENSION, "_locales"));
}

// 5) Validate extension/manifest.json exists and is valid JSON
const extManifestPath = path.join(EXTENSION, "manifest.json");
if (!fs.existsSync(extManifestPath)) {
  console.error("build-extension: extension/manifest.json was not created.");
  process.exit(1);
}
try {
  JSON.parse(fs.readFileSync(extManifestPath, "utf8"));
} catch (e) {
  console.error("build-extension: extension/manifest.json is invalid JSON:", (e && e.message) || e);
  process.exit(1);
}

console.log("Extension folder ready:", EXTENSION);
console.log("Load unpacked: select the ./extension folder in chrome://extensions");
