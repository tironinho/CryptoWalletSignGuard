/**
 * Validates the release zip (dist/store/CryptoWalletSignGuard.zip):
 * - manifest.json at root
 * - No entry name contains backslash
 * - No *.map, no node_modules/, no src/, no scripts/
 * Run after pack. Exit 1 on failure.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.cwd());
const ZIP_PATH = path.join(ROOT, "dist", "store", "CryptoWalletSignGuard.zip");

if (!fs.existsSync(ZIP_PATH)) {
  console.error("validate-release-zip: zip not found:", ZIP_PATH, "- Run npm run pack first.");
  process.exit(1);
}

let AdmZip;
try {
  AdmZip = (await import("adm-zip")).default;
} catch (e) {
  console.error("validate-release-zip: adm-zip required. npm i -D adm-zip");
  process.exit(1);
}

const zip = new AdmZip(ZIP_PATH);
const entries = zip.getEntries();
let failed = false;

const hasManifestRoot = entries.some((e) => !e.isDirectory && (e.entryName === "manifest.json" || e.entryName === "manifest.json/"));
if (!hasManifestRoot) {
  console.error("validate-release-zip: manifest.json must be at root of zip.");
  failed = true;
}

for (const e of entries) {
  const name = e.entryName;
  if (name.includes("\\")) {
    console.error("validate-release-zip: entry with backslash not allowed:", name);
    failed = true;
  }
  if (name.endsWith(".map") || name.includes(".map/")) {
    console.error("validate-release-zip: sourcemaps not allowed in store zip:", name);
    failed = true;
  }
  const lower = name.toLowerCase();
  if (lower.includes("node_modules/") || lower.startsWith("node_modules")) {
    console.error("validate-release-zip: node_modules not allowed:", name);
    failed = true;
  }
  if (lower.includes("src/") || lower.startsWith("src/")) {
    console.error("validate-release-zip: src/ not allowed:", name);
    failed = true;
  }
  if (lower.includes("scripts/") || lower.startsWith("scripts/")) {
    console.error("validate-release-zip: scripts/ not allowed:", name);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("OK: Release zip valid (manifest at root, no backslash, no .map, no node_modules/src/scripts).");
