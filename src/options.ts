import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { normalizeDomainLine } from "./shared/utils";
import { t } from "./i18n";
import { safeStorageGet, safeStorageSet, safeSendMessage } from "./runtimeSafe";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const HISTORY_KEY = "sg_history_v1";

type TabName = "settings" | "security" | "lists" | "history";

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
  if (name === "lists") loadListsTab();
}

type ListsStatus = {
  ok: boolean;
  updatedAt?: number;
  counts?: {
    trustedDomains: number;
    blockedDomains: number;
    blockedAddresses: number;
    scamTokens: number;
    userTrustedDomains: number;
    userBlockedDomains: number;
    userBlockedAddresses: number;
    userScamTokens: number;
  };
};

async function loadListsTab() {
  const statEls = document.querySelectorAll(".list-stat-n");
  const lastUpdatedEl = document.getElementById("listsLastUpdated");
  try {
    const resp = await safeSendMessage<ListsStatus>({ type: "SG_LISTS_STATUS" }, 3000);
    if (resp?.ok && resp?.counts) {
      const c = resp.counts;
      const totalTrusted = c.trustedDomains + c.userTrustedDomains;
      const totalBlockedD = c.blockedDomains + c.userBlockedDomains;
      const totalBlockedA = c.blockedAddresses + c.userBlockedAddresses;
      const totalScam = c.scamTokens + c.userScamTokens;
      if (statEls[0]) statEls[0].textContent = String(totalTrusted);
      if (statEls[1]) statEls[1].textContent = String(totalBlockedD);
      if (statEls[2]) statEls[2].textContent = String(totalBlockedA);
      if (statEls[3]) statEls[3].textContent = String(totalScam);
    }
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = resp?.updatedAt
        ? "Última atualização: " + new Date(resp.updatedAt).toLocaleString()
        : "—";
    }
  } catch {
    if (lastUpdatedEl) lastUpdatedEl.textContent = "Erro ao carregar.";
  }
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
  const tabName: TabName = hash === "security" ? "security" : hash === "lists" ? "lists" : hash === "history" ? "history" : "settings";
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
    showTab(h === "security" ? "security" : h === "lists" ? "lists" : h === "history" ? "history" : "settings");
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

  const historyExportBtn = document.getElementById("historyExport");
  historyExportBtn?.addEventListener("click", async () => {
    const items = await localGet<unknown[]>(HISTORY_KEY);
    const arr = Array.isArray(items) ? items : [];
    try {
      const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), history: arr }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signguard-history.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  });

  document.getElementById("listsRefreshNow")?.addEventListener("click", async () => {
    try {
      await safeSendMessage({ type: "SG_LISTS_REFRESH_NOW" }, 15000);
      loadListsTab();
    } catch {}
  });

  const listsSearchInput = document.getElementById("listsSearchInput") as HTMLInputElement | null;
  const listsSearchType = document.getElementById("listsSearchType") as HTMLSelectElement | null;
  const listsSearchResults = document.getElementById("listsSearchResults");
  document.getElementById("listsSearchBtn")?.addEventListener("click", async () => {
    const query = listsSearchInput?.value?.trim() ?? "";
    const type = (listsSearchType?.value || "") as "" | "domain" | "address" | "token";
    if (!listsSearchResults) return;
    try {
      const resp = await safeSendMessage<{ ok?: boolean; items?: Array<{ type: string; value?: string; kind?: string; source?: string; chainId?: string; address?: string; symbol?: string }>; total?: number }>({
        type: "SG_LISTS_SEARCH",
        payload: { query, type, page: 0, pageSize: 50 },
      }, 3000);
      if (!resp?.ok || !Array.isArray(resp.items)) {
        listsSearchResults.innerHTML = "<p>Nenhum resultado.</p>";
        return;
      }
      const items = resp.items;
      const total = resp.total ?? items.length;
      listsSearchResults.innerHTML = items.length === 0
        ? "<p>Nenhum resultado.</p>"
        : "<p style='margin:0 0 8px 0;color:var(--text-muted);'>" + total + " resultado(s)</p>" + items.map((it: any) => {
            if (it.type === "domain") return `<div style="margin-bottom:6px;"><code>${escapeHtml(it.value || "")}</code><span class="list-badge ${it.source === "user" ? "list-badge-user" : "list-badge-feed"}">${it.kind === "blocked" ? "bloqueado" : "confiável"} · ${it.source || "feed"}</span></div>`;
            if (it.type === "address") return `<div style="margin-bottom:6px;"><code class="sg-mono">${escapeHtml((it.value || "").slice(0, 20))}…</code><span class="list-badge list-badge-feed">${it.source || "feed"}</span></div>`;
            if (it.type === "token") return `<div style="margin-bottom:6px;"><code>${escapeHtml(it.chainId || "")}</code> <code class="sg-mono">${escapeHtml((it.address || "").slice(0, 16))}…</code>${it.symbol ? " " + escapeHtml(it.symbol) : ""}<span class="list-badge list-badge-feed">${it.source || "feed"}</span></div>`;
            return "";
          }).join("");
    } catch {
      listsSearchResults.innerHTML = "<p>Erro ao buscar.</p>";
    }
  });

  function escapeHtml(s: string): string {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  const listsAddDomain = document.getElementById("listsAddDomain") as HTMLInputElement | null;
  const listsAddDomainKind = document.getElementById("listsAddDomainKind") as HTMLSelectElement | null;
  document.getElementById("listsAddDomainBtn")?.addEventListener("click", async () => {
    const domain = listsAddDomain?.value?.trim();
    const type = (listsAddDomainKind?.value || "userTrustedDomains") as "userTrustedDomains" | "userBlockedDomains";
    if (!domain) return;
    try {
      await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type, domain } }, 3000);
      if (listsAddDomain) listsAddDomain.value = "";
      loadListsTab();
    } catch {}
  });

  const listsAddAddress = document.getElementById("listsAddAddress") as HTMLInputElement | null;
  document.getElementById("listsAddAddressBtn")?.addEventListener("click", async () => {
    const address = listsAddAddress?.value?.trim();
    if (!address || !address.startsWith("0x")) return;
    try {
      await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "userBlockedAddresses", address } }, 3000);
      if (listsAddAddress) listsAddAddress.value = "";
      loadListsTab();
    } catch {}
  });

  const listsAddTokenChain = document.getElementById("listsAddTokenChain") as HTMLInputElement | null;
  const listsAddTokenAddr = document.getElementById("listsAddTokenAddr") as HTMLInputElement | null;
  document.getElementById("listsAddTokenBtn")?.addEventListener("click", async () => {
    const chainId = listsAddTokenChain?.value?.trim();
    const tokenAddress = listsAddTokenAddr?.value?.trim();
    if (!chainId || !tokenAddress || !tokenAddress.startsWith("0x")) return;
    try {
      await safeSendMessage({ type: "SG_LISTS_OVERRIDE_ADD", payload: { type: "userScamTokens", chainId, tokenAddress } }, 3000);
      if (listsAddTokenAddr) listsAddTokenAddr.value = "";
      loadListsTab();
    } catch {}
  });

  document.getElementById("listsExport")?.addEventListener("click", async () => {
    try {
      const resp = await safeSendMessage<{ ok?: boolean; data?: { userTrustedDomains?: string[]; userBlockedDomains?: string[]; userBlockedAddresses?: string[]; userScamTokens?: unknown[] } }>({ type: "SG_LISTS_EXPORT" }, 3000);
      if (!resp?.ok || !resp?.data) return;
      const blob = new Blob([JSON.stringify({ ...resp.data, exportedAt: Date.now() }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signguard-lists-overrides.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  });

  const listsImportFile = document.getElementById("listsImportFile") as HTMLInputElement | null;
  const listsImportStatus = document.getElementById("listsImportStatus");
  listsImportFile?.addEventListener("change", async () => {
    const file = listsImportFile?.files?.[0];
    if (!listsImportStatus) return;
    listsImportStatus.textContent = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await safeSendMessage({ type: "SG_LISTS_IMPORT", payload: { data } }, 5000);
      listsImportStatus.textContent = "Importado (apenas overrides).";
      loadListsTab();
    } catch (e) {
      listsImportStatus.textContent = "Erro: " + String((e as Error)?.message ?? e);
    }
    listsImportFile.value = "";
  });

  loadHistory();
})();
