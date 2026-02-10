import { build, context } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const clean = args.has("--clean");

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

if (clean) {
  rimraf(DIST);
  console.log("Cleaned dist/");
  process.exit(0);
}

rimraf(DIST);
fs.mkdirSync(DIST, { recursive: true });

// Copy static assets
copyFile(path.join(ROOT, "manifest.json"), path.join(DIST, "manifest.json"));
copyFile(path.join(SRC, "options.html"), path.join(DIST, "options.html"));
copyFile(path.join(SRC, "overlay.css"), path.join(DIST, "overlay.css"));
copyDir(path.join(SRC, "icons"), path.join(DIST, "icons"));
copyDir(path.join(SRC, "_locales"), path.join(DIST, "_locales"));

const common = {
  bundle: true,
  sourcemap: true,
  platform: "browser",
  target: ["chrome120"],
  format: "esm",
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
};

const entryPoints = {
  background: path.join(SRC, "background.ts"),
  content: path.join(SRC, "content.ts"),
  main: path.join(SRC, "mainWorld.ts"),
  options: path.join(SRC, "options.ts"),
};

const contexts = [];

for (const [name, entry] of Object.entries(entryPoints)) {
  const opts = {
    ...common,
    entryPoints: [entry],
    outfile: path.join(DIST, `${name}.js`),
  };

  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
    contexts.push(ctx);
  } else {
    await build(opts);
  }
}

console.log("Build complete:", DIST);
if (watch) console.log("Watching for changes... (reload extension after rebuilds)");
