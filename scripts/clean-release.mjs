/**
 * Removes release zips: dist/store/*.zip and any *.zip in project root.
 * Use before pack if you want a clean output, or to remove accidental zips.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const STORE_DIR = path.join(ROOT, "dist", "store");

let removed = [];

try {
  if (fs.existsSync(STORE_DIR)) {
    for (const name of fs.readdirSync(STORE_DIR)) {
      if (name.toLowerCase().endsWith(".zip")) {
        const full = path.join(STORE_DIR, name);
        fs.unlinkSync(full);
        removed.push(full);
      }
    }
  }
} catch (e) {
  console.warn("clean-release: could not clean dist/store:", (e && e.message) || e);
}

try {
  const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true });
  for (const e of rootEntries) {
    if (e.isFile() && e.name.toLowerCase().endsWith(".zip")) {
      const full = path.join(ROOT, e.name);
      fs.unlinkSync(full);
      removed.push(full);
    }
  }
} catch (e) {
  console.warn("clean-release: could not clean root:", (e && e.message) || e);
}

if (removed.length) {
  console.log("Removed:", removed.join(", "));
} else {
  console.log("No release zips to remove.");
}
