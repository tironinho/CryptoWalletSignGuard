/**
 * Validates that P1 features are present in built extension (mainWorld.js, background.js).
 * Run after npm run build. Exit 1 if any required string is missing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");

const MAINWORLD_REQUIRED = [
  "eth_sendRawTransaction",
  "eth_signTransaction",
  "wallet_invokeSnap",
  "wallet_requestSnaps",
];
const BACKGROUND_REQUIRED = ["SG_DIAG_EXPORT"];

let failed = false;

function readSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

const mainWorldPath = path.join(EXTENSION, "mainWorld.js");
const backgroundPath = path.join(EXTENSION, "background.js");

if (!fs.existsSync(mainWorldPath)) {
  console.error("validate-feature-completeness: extension/mainWorld.js not found. Run npm run build first.");
  process.exit(1);
}
if (!fs.existsSync(backgroundPath)) {
  console.error("validate-feature-completeness: extension/background.js not found. Run npm run build first.");
  process.exit(1);
}

const mainWorldJs = readSafe(mainWorldPath);
const backgroundJs = readSafe(backgroundPath);

for (const s of MAINWORLD_REQUIRED) {
  if (!mainWorldJs.includes(s)) {
    console.error("validate-feature-completeness: mainWorld.js must contain:", s);
    failed = true;
  }
}
for (const s of BACKGROUND_REQUIRED) {
  if (!backgroundJs.includes(s)) {
    console.error("validate-feature-completeness: background.js must contain:", s);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("OK: P1 feature-completeness (mainWorld intercept + SG_DIAG_EXPORT) validated.");
