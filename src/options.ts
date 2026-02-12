import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { normalizeDomainLine } from "./shared/utils";
import { t } from "./i18n";
import { safeStorageGet, safeStorageSet } from "./runtimeSafe";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const HISTORY_KEY = "sg_history";

type TabName = "settings" | "security" | "history";

function showTab(name: TabName) {
  const tabs = document.querySelectorAll(".tab-btn");
  for (let i = 0; i < tabs.length; i++) {
    const b = tabs[i] as HTMLElement;
    b.classList.toggle("active", b.getAttribute("data-tab") === name);
  }
  const panels = document.querySelectorAll(".tab-panel");
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i] as HTMLElement;
    const panelId = p.id;
    const expectedId = "tab-" + name;
    p.classList.toggle("hidden", panelId !== expectedId);
    p.classList.toggle("active", panelId === expectedId);
  }
  if (name === "history") loadHistory();
}

function localGet<T = unknown>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(null);
      chrome.storage.local.get(key, (r) => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve(null);
        resolve(((r as Record<string, unknown>)?.[key] as T) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function loadHistory() {
  const listEl = $("historyList");
  if (!listEl) return;
  const items = await localGet<unknown[]>(HISTORY_KEY);
  const arr = Array.isArray(items) ? items.slice().reverse() : [];
  if (arr.length === 0) {
    listEl.innerHTML = `<p style="color:#94a3b8;margin:0;">${t("historyEmpty") || "Nenhum registro."}</p>`;
    return;
  }
  listEl.innerHTML = arr.map((e: any) => {
    const ts = e.ts ? new Date(e.ts).toLocaleString() : "—";
    const host = e.host || "—";
    const action = e.action || e.method || "—";
    const decision = e.decision === "ALLOW" ? (t("decision_allow") || "Permitido") : (t("decision_block") || "Bloqueado");
    const score = e.score != null ? String(e.score) : "";
    const value = e.valueEth ? ` ${e.valueEth} ETH` : "";
    return `<div style="background:rgba(30,41,59,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:10px;padding:12px;margin-bottom:8px;"><div style="font-size:0.85rem;color:#94a3b8;">${ts} · ${host}</div><div>${action} · ${decision}${score ? " · " + score : ""}${value}</div></div>`;
  }).join("");
}

async function load(): Promise<Settings> {
  const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
  return r.ok ? (r.data as Settings) : DEFAULT_SETTINGS;
}

async function save(s: Settings) {
  await safeStorageSet(s as unknown as Record<string, unknown>);
}

function linesToList(v: string): string[] {
  return v
    .split("\n")
    .map((x) => normalizeDomainLine(x))
    .filter(Boolean);
}

function listToLines(v: string[]): string {
  return v.join("\n");
}

(async function init() {
  const s = await load();

  const showUsdEl = $<HTMLInputElement>("showUsd");
  const addressIntelEl = $<HTMLInputElement>("addressIntel");
  const fortressModeEl = $<HTMLInputElement>("fortressMode");
  const whitelistInputEl = $<HTMLTextAreaElement>("whitelistInput");
  const saveWhitelistBtn = $("saveWhitelist");
  const clearHistoryBtn = $("clearHistory");

  if (showUsdEl) showUsdEl.checked = s.showUsd !== false;
  if (addressIntelEl) addressIntelEl.checked = s.addressIntelEnabled !== false;
  if (fortressModeEl) fortressModeEl.checked = s.fortressMode === true;
  const domains = (s.trustedDomains?.length ? s.trustedDomains : s.allowlist) ?? [];
  if (whitelistInputEl) whitelistInputEl.value = listToLines(domains);

  const hash = (location.hash || "").replace(/^#/, "") || "settings";
  const tabName: TabName = hash === "security" ? "security" : hash === "history" ? "history" : "settings";
  showTab(tabName);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = (btn as HTMLElement).getAttribute("data-tab") as TabName;
      if (t) {
        location.hash = t;
        showTab(t);
      }
    });
  });

  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").replace(/^#/, "") || "settings";
    showTab(h === "security" ? "security" : h === "history" ? "history" : "settings");
  });

  showUsdEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, showUsd: showUsdEl.checked });
  });
  addressIntelEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, addressIntelEnabled: addressIntelEl.checked });
  });
  fortressModeEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, fortressMode: fortressModeEl.checked });
  });

  saveWhitelistBtn?.addEventListener("click", async () => {
    const latest = await load();
    const lines = whitelistInputEl?.value ?? "";
    const list = linesToList(lines);
    await save({
      ...latest,
      allowlist: list,
      trustedDomains: list,
    });
  });

  clearHistoryBtn?.addEventListener("click", async () => {
    try {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: [] }, () => resolve());
      });
      loadHistory();
    } catch {}
  });

  loadHistory();
})();
