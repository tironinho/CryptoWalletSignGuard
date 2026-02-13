/**
 * Zips the contents of ./extension/ so manifest.json is at the root of the zip.
 * Run npm run build first (which produces extension/).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");
const ZIP_NAME = "CryptoWalletSignGuard.zip";
const ZIP_PATH = path.join(ROOT, ZIP_NAME);

if (!fs.existsSync(EXTENSION)) {
  console.error("extension/ not found. Run npm run build first.");
  process.exit(1);
}
const extManifest = path.join(EXTENSION, "manifest.json");
if (!fs.existsSync(extManifest)) {
  console.error("extension/manifest.json not found. Run npm run build first.");
  process.exit(1);
}

try {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  if (process.platform === "win32") {
    const dest = ZIP_PATH.replace(/'/g, "''");
    const extDir = EXTENSION.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Set-Location -LiteralPath '${extDir.replace(/'/g, "''")}'; Compress-Archive -Path '*' -DestinationPath '${dest}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`cd '${EXTENSION}' && zip -r '${ZIP_PATH}' .`, { stdio: "inherit" });
  }
  console.log("Pack complete:", ZIP_PATH, "(manifest at root of zip)");
} catch (e) {
  console.error("Pack failed:", (e && e.message) || e);
  process.exit(1);
}
