/**
 * Release validation: manifest must not have host_permissions; must have all required
 * optional_host_permissions; __MSG_extShortName__ must have a key in default locale.
 * Run after build (extension/ exists). Exit 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const EXTENSION = path.join(ROOT, "extension");
const MANIFEST_PATH = path.join(EXTENSION, "manifest.json");

// Allowlist of manifest permission names supported by this project. "permissions" is NOT a valid Chrome permission.
const ALLOWED_PERMISSIONS = new Set([
  "storage",
  "alarms",
  "tabs",
]);

// Allowlist of origins that must appear in optional_host_permissions (aligned with src/shared/optionalOrigins.ts)
const REQUIRED_OPTIONAL_ORIGINS = [
  "https://raw.githubusercontent.com/*",
  "https://api.cryptoscamdb.org/*",
  "https://gitlab.com/*",
  "https://gateway.ipfs.io/*",
  "https://api.llama.fi/*",
  "https://api.coingecko.com/*",
  "https://api.dexscreener.com/*",
  "https://api.tenderly.co/*",
  "https://cjnzidctntqzamhwmwkt.supabase.co/*",
];

let failed = false;

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error("validate-manifest-permissions: extension/manifest.json not found. Run npm run build first.");
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
} catch (e) {
  console.error("validate-manifest-permissions: invalid manifest JSON:", (e && e.message) || e);
  process.exit(1);
}

if (manifest.host_permissions != null) {
  console.error("validate-manifest-permissions: FAIL — manifest must NOT contain host_permissions. Remove it; use only optional_host_permissions.");
  failed = true;
}

const perms = manifest.permissions;
if (Array.isArray(perms)) {
  for (const p of perms) {
    if (!ALLOWED_PERMISSIONS.has(p)) {
      console.error("validate-manifest-permissions: FAIL — Unknown/unsupported manifest permission:", p);
      failed = true;
    }
  }
} else {
  console.error("validate-manifest-permissions: FAIL — manifest.permissions must be an array.");
  failed = true;
}

const optional = manifest.optional_host_permissions;
if (!Array.isArray(optional)) {
  console.error("validate-manifest-permissions: FAIL — optional_host_permissions must be an array.");
  failed = true;
} else {
  const set = new Set(optional);
  for (const req of REQUIRED_OPTIONAL_ORIGINS) {
    if (!set.has(req)) {
      console.error("validate-manifest-permissions: FAIL — optional_host_permissions missing required origin:", req);
      failed = true;
    }
  }
}

const defaultLocale = manifest.default_locale || "en";
const localePath = path.join(EXTENSION, "_locales", defaultLocale, "messages.json");
if (fs.existsSync(localePath)) {
  try {
    const messages = JSON.parse(fs.readFileSync(localePath, "utf8"));
    if (!messages.extShortName || !messages.extShortName.message) {
      console.error("validate-manifest-permissions: FAIL — default locale (", defaultLocale, ") messages.json must contain extShortName.");
      failed = true;
    }
  } catch (e) {
    console.error("validate-manifest-permissions: FAIL — could not read default locale messages:", (e && e.message) || e);
    failed = true;
  }
} else {
  console.error("validate-manifest-permissions: FAIL — default locale file not found:", localePath);
  failed = true;
}

const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
const msgPlaceholders = raw.match(/__MSG_[a-zA-Z0-9_]+__/g) || [];
for (const ph of msgPlaceholders) {
  const key = ph.slice(6, -2);
  const msgPath = path.join(EXTENSION, "_locales", defaultLocale, "messages.json");
  if (!fs.existsSync(msgPath)) continue;
  try {
    const messages = JSON.parse(fs.readFileSync(msgPath, "utf8"));
    if (!messages[key]) {
      console.error("validate-manifest-permissions: FAIL — placeholder", ph, "has no key", key, "in default locale.");
      failed = true;
    }
  } catch {}
}

if (failed) process.exit(1);
console.log("validate-manifest-permissions: OK (no host_permissions, optional_host_permissions complete, extShortName present).");
