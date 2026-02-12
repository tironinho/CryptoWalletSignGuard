import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, "dist");
const ZIP_NAME = "signguard-mvp-dist.zip";
const ZIP_PATH = path.join(ROOT, ZIP_NAME);

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found. Run npm run build first.");
  process.exit(1);
}

try {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${DIST}' -DestinationPath '${ZIP_PATH}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`zip -r '${ZIP_PATH}' dist`, { cwd: ROOT, stdio: "inherit" });
  }
  console.log("Pack complete:", ZIP_PATH);
} catch (e) {
  console.error("Pack failed:", (e && e.message) || e);
  process.exit(1);
}
