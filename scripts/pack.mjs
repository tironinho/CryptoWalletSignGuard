import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, "dist");
const ZIP_NAME = "CryptoWalletSignGuard.zip";
const ZIP_PATH = path.join(ROOT, ZIP_NAME);

if (!fs.existsSync(path.join(ROOT, "manifest.json"))) {
  console.error("manifest.json not found in project root.");
  process.exit(1);
}
if (!fs.existsSync(DIST)) {
  console.error("dist/ not found. Run npm run build first.");
  process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, "_locales"))) {
  console.error("_locales/ not found in project root.");
  process.exit(1);
}

try {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  if (process.platform === "win32") {
    const dest = ZIP_PATH.replace(/'/g, "''");
    const manifestPath = path.join(ROOT, "manifest.json").replace(/'/g, "''");
    const distPath = path.join(ROOT, "dist").replace(/'/g, "''");
    const localesPath = path.join(ROOT, "_locales").replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${manifestPath}','${distPath}','${localesPath}' -DestinationPath '${dest}' -Force"`,
      { stdio: "inherit", cwd: ROOT }
    );
  } else {
    execSync(
      `zip -r '${ZIP_PATH}' manifest.json dist _locales`,
      { stdio: "inherit", cwd: ROOT }
    );
  }
  console.log("Pack complete:", ZIP_PATH, "(manifest + dist/ + _locales/ at root of zip)");
} catch (e) {
  console.error("Pack failed:", (e && e.message) || e);
  process.exit(1);
}
