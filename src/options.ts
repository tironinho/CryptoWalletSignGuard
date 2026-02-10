import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { normalizeDomainLine } from "./shared/utils";
import { t } from "./i18n";
import { SUGGESTED_TRUSTED_DOMAINS } from "./shared/constants";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function applyI18n(root: ParentNode = document) {
  const nodes = root.querySelectorAll<HTMLElement>("[data-i18n]");
  for (const el of nodes) {
    const key = el.getAttribute("data-i18n");
    if (!key) continue;
    el.textContent = t(key);
  }
}

async function load(): Promise<Settings> {
  const got = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return got as Settings;
}

async function save(s: Settings) {
  await chrome.storage.sync.set(s);
}

function linesToList(v: string) {
  return v
    .split("\n")
    .map((x) => normalizeDomainLine(x))
    .filter(Boolean);
}

function listToLines(v: string[]) {
  return v.join("\n");
}

(async function init() {
  applyI18n();
  document.title = t("optionsTitle");

  const s = await load();
  $("riskWarnings").checked = s.riskWarnings;
  $("showConnectOverlay").checked = s.showConnectOverlay;
  $("blockHighRisk").checked = s.blockHighRisk;
  $("domainChecks").checked = s.domainChecks;
  $("allowlist").value = listToLines(s.allowlist);

  $("save").addEventListener("click", async () => {
    const next: Settings = {
      riskWarnings: $("riskWarnings").checked,
      showConnectOverlay: $("showConnectOverlay").checked,
      blockHighRisk: $("blockHighRisk").checked,
      domainChecks: $("domainChecks").checked,
      allowlist: linesToList($("allowlist").value)
    };
    await save(next);
    const st = $("status");
    st.style.opacity = "1";
    setTimeout(() => (st.style.opacity = "0"), 1200);
  });

  $("addSuggested").addEventListener("click", async () => {
    const current = linesToList($("allowlist").value);
    const merged = Array.from(new Set([...current, ...SUGGESTED_TRUSTED_DOMAINS.map((d) => normalizeDomainLine(d))])).filter(Boolean);
    merged.sort();
    $("allowlist").value = listToLines(merged);
    const next: Settings = {
      riskWarnings: $("riskWarnings").checked,
      showConnectOverlay: $("showConnectOverlay").checked,
      blockHighRisk: $("blockHighRisk").checked,
      domainChecks: $("domainChecks").checked,
      allowlist: merged
    };
    await save(next);
    const st = $("status");
    st.style.opacity = "1";
    setTimeout(() => (st.style.opacity = "0"), 1200);
  });
})();
