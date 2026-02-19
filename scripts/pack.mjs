/**
 * Zips the contents of ./extension/ with manifest.json at the root.
 * Cross-platform (Node only): POSIX paths in zip, no sourcemaps.
 * Run npm run build first.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");
const STORE_DIR = path.join(ROOT, "dist", "store");
const ZIP_NAME = "CryptoWalletSignGuard.zip";
const ZIP_PATH = path.join(STORE_DIR, ZIP_NAME);

// Validations before pack
const { execSync } = await import("node:child_process");
try {
  execSync(`node "${path.join(ROOT, "scripts", "validate-manifest-permissions.mjs")}"`, { cwd: ROOT, stdio: "inherit" });
  execSync(`node "${path.join(ROOT, "scripts", "validate-no-node-modules.mjs")}"`, { cwd: ROOT, stdio: "inherit" });
  execSync(`node "${path.join(ROOT, "scripts", "validate-feature-completeness.mjs")}"`, { cwd: ROOT, stdio: "inherit" });
} catch (e) {
  process.exit(1);
}

if (!fs.existsSync(EXTENSION)) {
  console.error("extension/ not found. Run npm run build first.");
  process.exit(1);
}
if (!fs.existsSync(path.join(EXTENSION, "manifest.json"))) {
  console.error("extension/manifest.json not found. Run npm run build first.");
  process.exit(1);
}

const IGNORE_SUFFIX = new Set([".map", ".ts", ".tsx", ".md", ".zip"]);
const IGNORE_NAME = new Set([".DS_Store", "node_modules", "src", "scripts"]);

function shouldIgnore(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (IGNORE_NAME.has(normalized.split("/")[0])) return true;
  const lower = normalized.toLowerCase();
  if (lower.includes("/node_modules/") || lower.includes("src/") || lower.includes("scripts/")) return true;
  for (const suf of IGNORE_SUFFIX) {
    if (lower.endsWith(suf)) return true;
  }
  return false;
}

function walkDir(dir, baseDir, cb) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    const posix = rel.split(path.sep).join("/");
    if (shouldIgnore(posix)) continue;
    if (e.isDirectory()) walkDir(full, baseDir, cb);
    else cb(full, posix);
  }
}

if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

await new Promise((resolve, reject) => {
  const out = fs.createWriteStream(ZIP_PATH);
  const archive = archiver("zip", { zlib: { level: 9 } });

  out.on("close", () => resolve());
  archive.on("error", (err) => reject(err));

  archive.pipe(out);

  walkDir(EXTENSION, EXTENSION, (abs, posixRel) => {
    archive.file(abs, { name: posixRel });
  });

  archive.finalize();
});

console.log("Pack complete:", ZIP_PATH);

try {
  execSync(`node "${path.join(ROOT, "scripts", "validate-release-zip.mjs")}"`, { cwd: ROOT, stdio: "inherit" });
} catch (e) {
  process.exit(1);
}

console.log("");
console.log("UPLOAD PARA CHROME WEB STORE: dist/store/CryptoWalletSignGuard.zip");
console.log("(NÃO compacte o repositório inteiro — use apenas este zip.)");
