import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");
const ZIP_NAME = "crypto-wallet-signguard.zip";
const ZIP_PATH = path.join(ROOT, ZIP_NAME);

if (!fs.existsSync(EXTENSION)) {
  console.error("extension/ not found. Run npm run build first.");
  process.exit(1);
}

try {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  if (process.platform === "win32") {
    // Zip CONTENTS of extension/ so manifest.json is at root of zip (required for store/install)
    const dest = ZIP_PATH.replace(/\\/g, "\\\\");
    execSync(
      `powershell -NoProfile -Command "Set-Location -LiteralPath '${EXTENSION.replace(/'/g, "''")}'; Compress-Archive -Path '*' -DestinationPath '${dest}' -Force"`,
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
