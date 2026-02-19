/**
 * Validates: (1) no node_modules inside extension/, (2) no .zip files in project root.
 * Release zip must be in dist/store/ only. Fails (exit 1) if any violation found.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");

function exists(dirOrFile) {
  try {
    return fs.existsSync(dirOrFile);
  } catch {
    return false;
  }
}

let failed = false;

try {
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const e of rootFiles) {
    if (e.isFile() && e.name.toLowerCase().endsWith(".zip")) {
      console.error("ERROR: .zip file in project root:", e.name, "- Release zip must be in dist/store/ only. Move or delete it.");
      failed = true;
      break;
    }
  }
} catch {
  // ignore
}

if (exists(EXTENSION)) {
  function walk(dir, check) {
    try {
      const ents = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of ents) {
        const full = path.join(dir, e.name);
        if (check(full, e)) return true;
        if (e.isDirectory() && walk(full, check)) return true;
      }
    } catch {}
    return false;
  }
  if (walk(EXTENSION, (full, e) => e.name === "node_modules")) {
    console.error("ERROR: node_modules/ found inside extension/. Run npm run clean then npm run build.");
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("OK: No node_modules in extension/, no .zip in project root.");
