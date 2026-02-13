/**
 * CSP validation: fail build if extension pages use remote/inline scripts or eval.
 * Run after build; scans dist/popup.html and dist/options.html.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, "dist");

const FORBIDDEN = [
  { pattern: /cdn\.tailwindcss\.com/i, name: "Tailwind CDN (remote script)" },
  { pattern: /<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i, name: "inline script (no src=)" },
  { pattern: /unsafe-eval/i, name: "unsafe-eval" },
  { pattern: /eval\s*\(/i, name: "eval(" },
  { pattern: /<script[^>]+src\s*=\s*["']https?:\/\//i, name: "remote script (src=https://)" },
];

const files = ["popup.html", "options.html"];
let failed = false;

for (const name of files) {
  const filePath = path.join(DIST, name);
  if (!fs.existsSync(filePath)) {
    console.warn("validate-csp: skip (not found):", filePath);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const { pattern, name: ruleName } of FORBIDDEN) {
    if (pattern.test(content)) {
      console.error("CSP validation FAILED:", filePath, "— found:", ruleName);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Remove inline/remote scripts and eval from extension pages. Use only local JS/CSS.");
  process.exit(1);
}
console.log("CSP validation passed (dist/popup.html, dist/options.html)");
