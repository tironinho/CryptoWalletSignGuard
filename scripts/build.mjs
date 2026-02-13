import { build, context } from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const clean = args.has("--clean");

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const EXTENSION = path.join(ROOT, "extension");

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(dstDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (clean) {
  rimraf(DIST);
  console.log("Cleaned dist/");
  process.exit(0);
}

rimraf(DIST);
fs.mkdirSync(DIST, { recursive: true });

// Do NOT copy manifest.json to dist — build-extension.mjs uses src/manifest.template.json and assembles extension/
copyFile(path.join(SRC, "options.html"), path.join(DIST, "options.html"));
copyFile(path.join(SRC, "popup.html"), path.join(DIST, "popup.html"));
copyFile(path.join(SRC, "onboarding.html"), path.join(DIST, "onboarding.html"));
copyFile(path.join(SRC, "onboarding.css"), path.join(DIST, "onboarding.css"));
copyFile(path.join(SRC, "dashboard", "dashboard.html"), path.join(DIST, "dashboard", "dashboard.html"));
copyFile(path.join(SRC, "dashboard", "dashboard.css"), path.join(DIST, "dashboard", "dashboard.css"));
copyFile(path.join(SRC, "overlay.css"), path.join(DIST, "overlay.css"));
copyDir(path.join(SRC, "icons"), path.join(DIST, "icons"));
const LOCALES_SRC = path.join(ROOT, "_locales");
const LOCALES_DST = path.join(DIST, "_locales");
if (fs.existsSync(LOCALES_SRC)) copyDir(LOCALES_SRC, LOCALES_DST);

const common = {
  bundle: true,
  sourcemap: true,
  platform: "browser",
  target: ["chrome120"],
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
};

// Required entryPoints (exact)
const entryPoints = {
  content: path.join(SRC, "content.ts"),
  mainWorld: path.join(SRC, "mainWorld.ts"),
};

const extraEntryPoints = {
  background: path.join(SRC, "background.ts"),
  options: path.join(SRC, "options.ts"),
  popup: path.join(SRC, "popup.ts"),
  onboarding: path.join(SRC, "onboarding.ts"),
  "dashboard/dashboard": path.join(SRC, "dashboard", "dashboard.ts"),
};

const contexts = [];

async function runBuild(name, entry, format) {
  const opts = { ...common, entryPoints: [entry], outfile: path.join(DIST, `${name}.js`), format };

  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
    contexts.push(ctx);
  } else {
    await build(opts);
  }
}

// Content script + injected mainWorld: classic scripts
for (const [name, entry] of Object.entries(entryPoints)) {
  await runBuild(name, entry, "iife");
}

// Background/options: ESM (background is service_worker module; options loaded as module)
for (const [name, entry] of Object.entries(extraEntryPoints)) {
  await runBuild(name, entry, "esm");
}

// Validate required dist artifacts (build-extension copies dist -> extension with flat manifest)
const required = [
  "background.js",
  "content.js",
  "mainWorld.js",
  "popup.html",
  "options.html",
  "overlay.css",
];
const missing = required.filter((name) => !fs.existsSync(path.join(DIST, name)));
if (missing.length) {
  console.error("Build validation failed. Missing in dist/:", missing.join(", "));
  process.exit(1);
}
// CSP: no remote/inline scripts in extension pages
execSync("node scripts/validate-csp.mjs", { stdio: "inherit", cwd: ROOT });
console.log("Build complete:", DIST);
if (watch) console.log("Watching for changes... (reload extension after rebuilds)");
