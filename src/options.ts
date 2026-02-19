import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { t } from "./i18n";
import { safeStorageGet, safeStorageSet, safeSendMessage } from "./runtimeSafe";
import { getOriginsForFeatures } from "./shared/optionalOrigins";
import { requestOptionalHostPermissions, removeOptionalHostPermissions } from "./permissions";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const HISTORY_KEY = "sg_history_v1";

async function hasOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (typeof chrome?.permissions?.contains !== "function") return false;
    return await chrome.permissions.contains({ origins });
  } catch {
    return false;
  }
}

async function requestOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (typeof chrome?.permissions?.request !== "function") return false;
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

async function removeOrigins(origins: string[]): Promise<boolean> {
  if (!origins.length) return true;
  try {
    if (typeof chrome?.permissions?.remove !== "function") return false;
    return await chrome.permissions.remove({ origins });
  } catch {
    return false;
  }
}

async function updateOptionalPermStatus() {
  const cloudOrigins = getOriginsForFeatures(["cloudIntel"]);
  const pricingOrigins = getOriginsForFeatures(["pricing"]);
  const simOrigins = getOriginsForFeatures(["simulation"]);
  const telemetryOrigins = getOriginsForFeatures(["telemetry"]);
  const [cloudOk, pricingOk, simOk, teleOk] = await Promise.all([
    hasOrigins(cloudOrigins),
    hasOrigins(pricingOrigins),
    hasOrigins(simOrigins),
    hasOrigins(telemetryOrigins),
  ]);
  const set = (id: string, granted: boolean, grantBtnId: string, revokeBtnId: string) => {
    const el = $(id);
    if (el) el.textContent = granted ? "Concedido" : "Não concedido";
    const g = $(grantBtnId);
    const r = $(revokeBtnId);
    if (g) (g as HTMLButtonElement).disabled = granted;
    if (r) (r as HTMLButtonElement).disabled = !granted;
  };
  set("cloudPermStatus", cloudOk, "cloudPermGrantBtn", "cloudPermRevokeBtn");
  set("pricingPermStatus", pricingOk, "pricingPermGrantBtn", "pricingPermRevokeBtn");
  set("simPermStatus", simOk, "simPermGrantBtn", "simPermRevokeBtn");
  set("telemetryPermStatus", teleOk, "telemetryPermGrantBtn", "telemetryPermRevokeBtn");
}

type TabName = "settings" | "security" | "lists" | "history" | "diagnostics";

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
  if (name === "diagnostics") loadDiagnosticsTab();
  if (name === "security") {
    loadSecurityWhitelist();
    loadSecuritySettings();
  }
}

async function loadSecurityWhitelist() {
  const whitelistInputEl = document.getElementById("whitelistInput") as HTMLTextAreaElement | null;
  if (!whitelistInputEl) return;
  try {
    const resp = await safeSendMessage<ListsExportSnapshot>({ type: "SG_LISTS_EXPORT" }, 3000);
    const trusted = resp?.overrides?.trustedDomains ?? [];
    whitelistInputEl.value = listToLines(trusted);
  } catch {
    whitelistInputEl.value = "";
  }
}

type ListsExportSnapshot = {
  ok?: boolean;
  updatedAt?: number;
  overrides?: {
    trustedDomains: string[];
    blockedDomains: string[];
    blockedAddresses: string[];
    scamTokens: Array<{ chainId: string; address: string }>;
  };
  totals?: {
    trustedDomainsTotal: number;
    blockedDomainsTotal: number;
    blockedAddressesTotal: number;
    scamTokensTotal: number;
  };
  sources?: Array<{ name: string; ok: boolean; count?: number; error?: string }>;
};

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
    userTrustedTokens: number;
  };
};

let __listsSnapshot: ListsExportSnapshot | null = null;

async function loadDiagnosticsTab() {
  const versionEl = document.getElementById("diagnosticsVersion");
  const lastRefreshEl = document.getElementById("diagnosticsLastRefresh");
  const countsEl = document.getElementById("diagnosticsCounts");
  const debugLogsCheck = document.getElementById("diagnosticsDebugLogs") as HTMLInputElement | null;
  try {
    const manifest = typeof chrome !== "undefined" && chrome.runtime?.getManifest ? chrome.runtime.getManifest() : null;
    if (versionEl) versionEl.textContent = (manifest as { version?: string })?.version ?? "—";
    const resp = await safeSendMessage<ListsStatus>({ type: "SG_LISTS_STATUS" }, 3000);
    if (lastRefreshEl) {
      lastRefreshEl.textContent = resp?.updatedAt ? new Date(resp.updatedAt).toLocaleString() : "—";
    }
    if (countsEl && resp?.ok && resp?.counts) {
      const c = resp.counts;
      countsEl.textContent = `trusted: ${c.trustedDomains + c.userTrustedDomains}, blocked domains: ${c.blockedDomains + c.userBlockedDomains}, blocked addresses: ${c.blockedAddresses + c.userBlockedAddresses}, scam tokens: ${c.scamTokens + c.userScamTokens}, trusted tokens: ${(c as any).userTrustedTokens ?? 0}`;
    } else if (countsEl) {
      countsEl.textContent = "—";
    }
    const debugOn = await localGet<boolean>("debugLogs");
    if (debugLogsCheck) debugLogsCheck.checked = debugOn === true;
  } catch {
    if (lastRefreshEl) lastRefreshEl.textContent = "Erro";
    if (countsEl) countsEl.textContent = "Erro";
  }
}

function listToLines(arr: string[]): string {
  return (arr ?? []).join("\n");
}

const ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;
const HEX40_REGEX = /^[a-fA-F0-9]{40}$/;

function parseAddressList(s: string): { ok: string[]; invalid: string[] } {
  const lines = (s ?? "").split("\n").map((x) => x.replace(/#.*$/, "").trim()).filter(Boolean);
  const ok: string[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    let norm = line.toLowerCase().replace(/^0x/, "");
    if (HEX40_REGEX.test(norm)) {
      ok.push("0x" + norm);
    } else if (ADDR_REGEX.test(line.toLowerCase())) {
      ok.push(line.toLowerCase());
    } else if (line) invalid.push(line);
  }
  return { ok: [...new Set(ok)], invalid };
}

function parseDomainList(s: string): string[] {
  const lines = (s ?? "").split("\n").map((x) => x.replace(/#.*$/, "").trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    let h = line.toLowerCase().replace(/^www\./, "").split("/")[0].trim();
    if (h && /^[a-z0-9.-]+$/.test(h) && h.length < 254) out.push(h);
  }
  return [...new Set(out)];
}

function parseAddresses(s: string): { ok: string[]; invalid: string[] } {
  return parseAddressList(s);
}

async function loadSecuritySettings() {
  const s = await load();
  const allowlistSpendersEl = $<HTMLTextAreaElement>("allowlistSpenders");
  const denylistSpendersEl = $<HTMLTextAreaElement>("denylistSpenders");
  const vaultEnabledEl = $<HTMLInputElement>("vaultEnabled");
  const vaultLockedEl = $<HTMLTextAreaElement>("vaultLockedContracts");
  const vaultStatusEl = $("vaultStatus");
  const simulationEnabledEl = $<HTMLInputElement>("simulationEnabled");
  const tenderlyAccountEl = $<HTMLInputElement>("tenderlyAccount");
  const tenderlyProjectEl = $<HTMLInputElement>("tenderlyProject");
  const tenderlyKeyEl = $<HTMLInputElement>("tenderlyKey");
  const cloudIntelEl = $<HTMLInputElement>("cloudIntelOptIn");
  const telemetryOptInEl = $<HTMLInputElement>("telemetryOptIn");
  const termsAcceptedEl = $<HTMLInputElement>("termsAccepted");
  const whitelistedDomainsEl = $<HTMLTextAreaElement>("whitelistedDomains");

  if (allowlistSpendersEl) allowlistSpendersEl.value = listToLines(s.allowlistSpenders ?? []);
  if (denylistSpendersEl) denylistSpendersEl.value = listToLines(s.denylistSpenders ?? []);
  const vaultBlockApprovalsEl = $<HTMLInputElement>("vaultBlockApprovals");
  if (vaultEnabledEl) vaultEnabledEl.checked = s.vault?.enabled === true;
  if (vaultBlockApprovalsEl) vaultBlockApprovalsEl.checked = s.vault?.blockApprovals === true;
  if (vaultLockedEl) vaultLockedEl.value = listToLines(s.vault?.lockedContracts ?? []);
  if (vaultStatusEl) {
    const until = s.vault?.unlockedUntil ?? 0;
    vaultStatusEl.textContent = until > Date.now()
      ? "Desbloqueado até: " + new Date(until).toLocaleTimeString()
      : "—";
  }
  if (simulationEnabledEl) simulationEnabledEl.checked = s.simulation?.enabled === true;
  if (tenderlyAccountEl) tenderlyAccountEl.value = s.simulation?.tenderlyAccount ?? "";
  if (tenderlyProjectEl) tenderlyProjectEl.value = s.simulation?.tenderlyProject ?? "";
  if (tenderlyKeyEl) tenderlyKeyEl.placeholder = s.simulation?.tenderlyKey ? "••••••••" : "";
  if (cloudIntelEl) cloudIntelEl.checked = s.cloudIntelOptIn === true;
  if (telemetryOptInEl) telemetryOptInEl.checked = (s.telemetryOptIn ?? s.telemetryEnabled) === true;
  if (whitelistedDomainsEl) whitelistedDomainsEl.value = listToLines(s.whitelistedDomains ?? []);
  if (termsAcceptedEl) {
    localGet<boolean>("termsAccepted").then((v) => {
      if (termsAcceptedEl) termsAcceptedEl.checked = v === true;
    });
  }
  updateOptionalPermStatus();
}

function linesToList(s: string): string[] {
  return (s ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function scamTokensToLines(tokens: Array<{ chainId: string; address: string }>): string {
  return (tokens ?? []).map((t) => `${t.chainId}:${t.address}`).join("\n");
}

function linesToScamTokens(s: string): string[] {
  return linesToList(s);
}

async function loadListsTab() {
  try {
    const resp = await safeSendMessage<ListsExportSnapshot>({ type: "SG_LISTS_EXPORT" }, 5000);
    __listsSnapshot = resp;
    const overrides = resp?.overrides ?? { trustedDomains: [], blockedDomains: [], blockedAddresses: [], scamTokens: [] };
    const totals = resp?.totals ?? { trustedDomainsTotal: 0, blockedDomainsTotal: 0, blockedAddressesTotal: 0, scamTokensTotal: 0 };
    const trusted = overrides.trustedDomains ?? [];
    const blockedDomains = overrides.blockedDomains ?? [];
    const blockedAddresses = overrides.blockedAddresses ?? [];
    const scamTokens = overrides.scamTokens ?? [];

    const trustedEl = document.getElementById("listsTrustedDomains") as HTMLTextAreaElement | null;
    const blockedDomainsEl = document.getElementById("listsBlockedDomains") as HTMLTextAreaElement | null;
    const blockedAddressesEl = document.getElementById("listsBlockedAddresses") as HTMLTextAreaElement | null;
    const scamTokensEl = document.getElementById("listsScamTokens") as HTMLTextAreaElement | null;

    if (trustedEl) trustedEl.value = listToLines(trusted);
    if (blockedDomainsEl) blockedDomainsEl.value = listToLines(blockedDomains);
    if (blockedAddressesEl) blockedAddressesEl.value = listToLines(blockedAddresses);
    if (scamTokensEl) scamTokensEl.value = scamTokensToLines(scamTokens);

    const lastUpdatedEl = document.getElementById("listsLastUpdated");
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = resp?.updatedAt
        ? "Atualizado em: " + new Date(resp.updatedAt).toLocaleString()
        : "Atualizado em: —";
    }

    const sourcesEl = document.getElementById("listsSources");
    if (sourcesEl) {
      const src = resp?.sources ?? [];
      sourcesEl.textContent = src.length
        ? src.map((s) => `${s.name}: ${s.ok ? "OK" : (s.error ?? "erro")}`).join(" · ")
        : "—";
    }

    const trustedCount = document.getElementById("listsTrustedCount");
    const blockedDomainsCount = document.getElementById("listsBlockedDomainsCount");
    const blockedAddressesCount = document.getElementById("listsBlockedAddressesCount");
    const scamTokensCount = document.getElementById("listsScamTokensCount");

    if (trustedCount) trustedCount.textContent = `Itens (override): ${trusted.length} · Total efetivo: ${totals.trustedDomainsTotal ?? 0}`;
    if (blockedDomainsCount) blockedDomainsCount.textContent = `Itens (override): ${blockedDomains.length} · Total efetivo: ${totals.blockedDomainsTotal ?? 0}`;
    if (blockedAddressesCount) blockedAddressesCount.textContent = `Itens (override): ${blockedAddresses.length} · Total efetivo: ${totals.blockedAddressesTotal ?? 0}`;
    if (scamTokensCount) scamTokensCount.textContent = `Itens (override): ${scamTokens.length} · Total efetivo: ${totals.scamTokensTotal ?? 0}`;

    ["listsTrustedError", "listsBlockedDomainsError", "listsBlockedAddressesError", "listsScamTokensError"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.style.display = "none"; el.textContent = ""; }
    });
  } catch {
    const lastUpdatedEl = document.getElementById("listsLastUpdated");
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

(async function init() {
  const s = await load();

  const showUsdEl = $<HTMLInputElement>("showUsd");
  const defaultExpandDetailsEl = $<HTMLInputElement>("defaultExpandDetails");
  const addressIntelEl = $<HTMLInputElement>("addressIntel");
  const fortressModeEl = $<HTMLInputElement>("fortressMode");
  const failModeEl = $<HTMLSelectElement>("failMode");
  const whitelistInputEl = $<HTMLTextAreaElement>("whitelistInput");
  const saveWhitelistBtn = $("saveWhitelist");
  const clearHistoryBtn = $("clearHistory");

  if (showUsdEl) showUsdEl.checked = s.showUsd !== false;
  if (defaultExpandDetailsEl) defaultExpandDetailsEl.checked = s.defaultExpandDetails !== false;
  if (addressIntelEl) addressIntelEl.checked = s.addressIntelEnabled !== false;
  if (fortressModeEl) fortressModeEl.checked = s.fortressMode === true;
  if (failModeEl) failModeEl.value = s.failMode === "fail_closed" ? "fail_closed" : "fail_open";
  if (whitelistInputEl) whitelistInputEl.value = "";

  const hash = (location.hash || "").replace(/^#/, "") || "settings";
  const tabName: TabName = hash === "security" || hash === "vault" ? "security" : hash === "lists" ? "lists" : hash === "history" ? "history" : hash === "diagnostics" ? "diagnostics" : "settings";
  showTab(tabName);

  const tabDiagnosticsBtn = document.getElementById("tabDiagnostics");
  localGet<boolean>("debugLogs").then((debugLogs) => {
    if (tabDiagnosticsBtn) tabDiagnosticsBtn.style.display = debugLogs === true ? "" : "none";
  });
  const diagnosticsDebugLogsEl = document.getElementById("diagnosticsDebugLogs") as HTMLInputElement | null;
  diagnosticsDebugLogsEl?.addEventListener("change", () => {
    chrome.storage?.local?.set({ debugLogs: diagnosticsDebugLogsEl.checked }, () => {});
  });

  const diagnosticsExportBtn = document.getElementById("diagnosticsExportBtn");
  const diagnosticsExportStatus = document.getElementById("diagnosticsExportStatus");
  diagnosticsExportBtn?.addEventListener("click", async () => {
    if (diagnosticsExportStatus) diagnosticsExportStatus.textContent = "A exportar…";
    try {
      const res = await safeSendMessage<{ ok?: boolean; export?: Record<string, unknown> }>({ type: "SG_DIAG_EXPORT" }, 5000);
      if (!res?.ok || !res?.export) {
        if (diagnosticsExportStatus) diagnosticsExportStatus.textContent = "Falha ao obter diagnóstico.";
        return;
      }
      const json = JSON.stringify(res.export, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      a.download = `signguard-diagnostics-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (diagnosticsExportStatus) diagnosticsExportStatus.textContent = "Descarregado.";
    } catch (e) {
      if (diagnosticsExportStatus) diagnosticsExportStatus.textContent = "Erro: " + String((e as Error)?.message ?? e);
    }
  });

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
    showTab(h === "security" || h === "vault" ? "security" : h === "lists" ? "lists" : h === "history" ? "history" : h === "diagnostics" ? "diagnostics" : "settings");
  });

  showUsdEl?.addEventListener("change", async () => {
    const wantOn = showUsdEl.checked;
    const errEl = $("showUsdError");
    if (errEl) { errEl.textContent = ""; errEl.style.display = "none"; }
    if (wantOn) {
      const granted = await requestOptionalHostPermissions("pricing");
      await updateOptionalPermStatus();
      if (!granted) {
        showUsdEl.checked = false;
        if (errEl) { errEl.textContent = "Permissões negadas. Conceda em Segurança → Privacidade (Preços USD)."; errEl.style.display = "block"; }
        return;
      }
    }
    const next = await load();
    await save({ ...next, showUsd: wantOn });
  });
  defaultExpandDetailsEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, defaultExpandDetails: defaultExpandDetailsEl.checked });
  });
  addressIntelEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, addressIntelEnabled: addressIntelEl.checked });
  });
  fortressModeEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, fortressMode: fortressModeEl.checked });
  });
  failModeEl?.addEventListener("change", async () => {
    const next = await load();
    await save({ ...next, failMode: (failModeEl.value === "fail_closed" ? "fail_closed" : "fail_open") as "fail_open" | "fail_closed" });
  });

  const showError = (id: string, msg: string) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; }
  };
  $("normalizeSpenders")?.addEventListener("click", () => {
    const allowEl = $<HTMLTextAreaElement>("allowlistSpenders");
    const denyEl = $<HTMLTextAreaElement>("denylistSpenders");
    const inv: string[] = [];
    if (allowEl) {
      const a = parseAddressList(allowEl.value);
      allowEl.value = listToLines(a.ok);
      inv.push(...a.invalid);
    }
    if (denyEl) {
      const d = parseAddressList(denyEl.value);
      denyEl.value = listToLines(d.ok);
      inv.push(...d.invalid);
    }
    showError("spendersError", inv.length ? "Descartados (inválidos): " + [...new Set(inv)].slice(0, 3).join(", ") : "");
  });
  $("applySpenders")?.addEventListener("click", async () => {
    const allow = $<HTMLTextAreaElement>("allowlistSpenders")?.value ?? "";
    const deny = $<HTMLTextAreaElement>("denylistSpenders")?.value ?? "";
    const a = parseAddressList(allow);
    const d = parseAddressList(deny);
    if (a.invalid.length || d.invalid.length) {
      showError("spendersError", "Endereços inválidos: " + [...a.invalid, ...d.invalid].slice(0, 3).join(", "));
      return;
    }
    showError("spendersError", "");
    const next = await load();
    await save({ ...next, allowlistSpenders: a.ok, denylistSpenders: d.ok });
  });
  $("revertSpenders")?.addEventListener("click", () => loadSecuritySettings());
  $("clearSpenders")?.addEventListener("click", async () => {
    const next = await load();
    await save({ ...next, allowlistSpenders: [], denylistSpenders: [] });
    loadSecuritySettings();
  });

  $("applyVault")?.addEventListener("click", async () => {
    const txt = $<HTMLTextAreaElement>("vaultLockedContracts")?.value ?? "";
    const { ok, invalid } = parseAddressList(txt);
    if (invalid.length) {
      showError("vaultError", "Endereços inválidos: " + invalid.slice(0, 3).join(", "));
      return;
    }
    showError("vaultError", "");
    const next = await load();
    const vault = next.vault ?? { enabled: false, lockedContracts: [], unlockedUntil: 0, blockApprovals: false };
    await save({
      ...next,
      vault: {
        ...vault,
        enabled: $<HTMLInputElement>("vaultEnabled")?.checked ?? false,
        blockApprovals: $<HTMLInputElement>("vaultBlockApprovals")?.checked ?? false,
        lockedContracts: ok,
      },
    });
    loadSecuritySettings();
  });
  $("revertVault")?.addEventListener("click", () => loadSecuritySettings());
  $("clearVault")?.addEventListener("click", async () => {
    const next = await load();
    const vault = next.vault ?? { enabled: false, lockedContracts: [], unlockedUntil: 0, blockApprovals: false };
    await save({ ...next, vault: { ...vault, enabled: false, lockedContracts: [] } });
    loadSecuritySettings();
  });
  $("vaultUnlockNow")?.addEventListener("click", async () => {
    try {
      await safeSendMessage({ type: "SG_VAULT_UNLOCK", payload: { durationMs: 5 * 60 * 1000 } }, 3000);
      loadSecuritySettings();
    } catch {}
  });

  $("applySimulation")?.addEventListener("click", async () => {
    const next = await load();
    const sim = next.simulation ?? { enabled: false, tenderlyAccount: "", tenderlyProject: "", tenderlyKey: "" };
    const keyEl = $<HTMLInputElement>("tenderlyKey");
    const wantEnabled = $<HTMLInputElement>("simulationEnabled")?.checked ?? false;
    if (wantEnabled) {
      const granted = await requestOptionalHostPermissions("simulation");
      await updateOptionalPermStatus();
      if (!granted) {
        if ($<HTMLInputElement>("simulationEnabled")) ($<HTMLInputElement>("simulationEnabled")!).checked = false;
        showError("simulationError", "Permissões negadas. Simulação requer acesso à API Tenderly.");
        return;
      }
    }
    await save({
      ...next,
      simulation: {
        ...sim,
        enabled: wantEnabled,
        tenderlyAccount: ($<HTMLInputElement>("tenderlyAccount")?.value ?? "").trim(),
        tenderlyProject: ($<HTMLInputElement>("tenderlyProject")?.value ?? "").trim(),
        tenderlyKey: keyEl?.value?.trim() ? keyEl.value.trim() : (sim.tenderlyKey ?? ""),
      },
    });
    showError("simulationError", "");
    loadSecuritySettings();
  });
  $("testSimulation")?.addEventListener("click", async () => {
    const errEl = $("simulationError");
    const acc = ($<HTMLInputElement>("tenderlyAccount")?.value ?? "").trim();
    const proj = ($<HTMLInputElement>("tenderlyProject")?.value ?? "").trim();
    const keyEl = $<HTMLInputElement>("tenderlyKey");
    const key = keyEl?.value?.trim() ?? "";
    const s = await load();
    const storedKey = s.simulation?.tenderlyKey ?? "";
    const hasKey = key ? key.length > 10 : storedKey.length > 10;
    if (!acc || !proj || !hasKey) {
      if (errEl) { errEl.textContent = "Preencha account, project e key."; errEl.style.display = "block"; }
      return;
    }
    if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
    try {
      const resp = await safeSendMessage<{ ok?: boolean; error?: string }>({ type: "SG_TEST_SIMULATION", payload: {} }, 5000);
      if (resp?.ok) {
        if (errEl) { errEl.textContent = "OK"; errEl.style.color = "#22c55e"; errEl.style.display = "block"; }
      } else {
        if (errEl) { errEl.textContent = resp?.error ?? "Falha"; errEl.style.color = "var(--danger)"; errEl.style.display = "block"; }
      }
    } catch (e) {
      if (errEl) { errEl.textContent = "Erro: " + String((e as Error)?.message ?? e); errEl.style.color = "var(--danger)"; errEl.style.display = "block"; }
    }
  });

  $<HTMLInputElement>("termsAccepted")?.addEventListener("change", () => {
    const el = $<HTMLInputElement>("termsAccepted");
    chrome.storage?.local?.set({ termsAccepted: el?.checked ?? false }, () => {});
  });
  $<HTMLInputElement>("cloudIntelOptIn")?.addEventListener("change", async () => {
    const el = $<HTMLInputElement>("cloudIntelOptIn");
    const errEl = $("cloudIntelError");
    const wantOn = el?.checked ?? false;
    if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
    if (wantOn) {
      const granted = await requestOptionalHostPermissions("cloudIntel");
      await updateOptionalPermStatus();
      if (!granted) {
        if (el) el.checked = false;
        if (errEl) { errEl.textContent = "Permissões negadas. Cloud Intel permanecerá desativado."; errEl.style.display = "block"; }
        return;
      }
    }
    const next = await load();
    await save({ ...next, cloudIntelOptIn: wantOn });
  });

  $("cloudPermGrantBtn")?.addEventListener("click", async () => {
    const errEl = $("cloudIntelError");
    if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
    const granted = await requestOptionalHostPermissions("cloudIntel");
    await updateOptionalPermStatus();
    if (granted) {
      const next = await load();
      await save({ ...next, cloudIntelOptIn: true });
      const cloudEl = $<HTMLInputElement>("cloudIntelOptIn");
      if (cloudEl) cloudEl.checked = true;
    } else if (errEl) { errEl.textContent = "Permissões negadas."; errEl.style.display = "block"; }
  });

  $("cloudPermRevokeBtn")?.addEventListener("click", async () => {
    await removeOptionalHostPermissions("cloudIntel");
    await updateOptionalPermStatus();
    const next = await load();
    await save({ ...next, cloudIntelOptIn: false });
    const cloudEl = $<HTMLInputElement>("cloudIntelOptIn");
    if (cloudEl) cloudEl.checked = false;
  });

  $("pricingPermGrantBtn")?.addEventListener("click", async () => {
    const errEl = $("cloudIntelError");
    if (errEl) errEl.style.display = "none";
    const granted = await requestOptionalHostPermissions("pricing");
    await updateOptionalPermStatus();
    if (granted) {
      const next = await load();
      await save({ ...next, showUsd: true });
      const showUsdEl = $<HTMLInputElement>("showUsd");
      if (showUsdEl) showUsdEl.checked = true;
    }
  });

  $("pricingPermRevokeBtn")?.addEventListener("click", async () => {
    await removeOptionalHostPermissions("pricing");
    await updateOptionalPermStatus();
    const next = await load();
    await save({ ...next, showUsd: false });
    const showUsdEl = $<HTMLInputElement>("showUsd");
    if (showUsdEl) showUsdEl.checked = false;
  });

  $("simPermGrantBtn")?.addEventListener("click", async () => {
    const granted = await requestOptionalHostPermissions("simulation");
    await updateOptionalPermStatus();
    if (granted) {
      const next = await load();
      const sim = next.simulation ?? { enabled: false, tenderlyAccount: "", tenderlyProject: "", tenderlyKey: "" };
      await save({ ...next, simulation: { ...sim, enabled: true } });
      const simEl = $<HTMLInputElement>("simulationEnabled");
      if (simEl) simEl.checked = true;
    }
  });

  $("simPermRevokeBtn")?.addEventListener("click", async () => {
    await removeOptionalHostPermissions("simulation");
    await updateOptionalPermStatus();
    const next = await load();
    const sim = next.simulation ?? { enabled: false, tenderlyAccount: "", tenderlyProject: "", tenderlyKey: "" };
    await save({ ...next, simulation: { ...sim, enabled: false } });
    const simEl = $<HTMLInputElement>("simulationEnabled");
    if (simEl) simEl.checked = false;
  });

  $("telemetryPermGrantBtn")?.addEventListener("click", async () => {
    const errEl = $("telemetryPermError");
    if (errEl) errEl.style.display = "none";
    const granted = await requestOptionalHostPermissions("telemetry");
    await updateOptionalPermStatus();
    if (granted) {
      const next = await load();
      await save({ ...next, telemetryOptIn: true });
      const te = $<HTMLInputElement>("telemetryOptIn");
      if (te) te.checked = true;
    } else if (errEl) { errEl.textContent = "Permissões negadas."; errEl.style.display = "block"; }
  });

  $("telemetryPermRevokeBtn")?.addEventListener("click", async () => {
    await removeOptionalHostPermissions("telemetry");
    await updateOptionalPermStatus();
    const next = await load();
    await save({ ...next, telemetryOptIn: false });
    const te = $<HTMLInputElement>("telemetryOptIn");
    if (te) te.checked = false;
  });

  $<HTMLInputElement>("telemetryOptIn")?.addEventListener("change", async () => {
    const el = $<HTMLInputElement>("telemetryOptIn");
    const errEl = $("telemetryPermError");
    const wantOn = el?.checked ?? false;
    if (errEl) errEl.style.display = "none";
    if (wantOn) {
      const terms = await localGet<boolean>("termsAccepted");
      if (!terms) {
        if (el) el.checked = false;
        if (errEl) { errEl.textContent = "Aceite os termos de uso primeiro."; errEl.style.display = "block"; }
        return;
      }
      const granted = await requestOptionalHostPermissions("telemetry");
      await updateOptionalPermStatus();
      if (!granted) {
        if (el) el.checked = false;
        if (errEl) { errEl.textContent = "Permissões negadas. Telemetria permanecerá desativada."; errEl.style.display = "block"; }
        return;
      }
    }
    const next = await load();
    await save({ ...next, telemetryOptIn: wantOn });
  });

  $("applyWhitelistedDomains")?.addEventListener("click", async () => {
    const raw = $<HTMLTextAreaElement>("whitelistedDomains")?.value ?? "";
    const domains = parseDomainList(raw);
    const next = await load();
    await save({ ...next, whitelistedDomains: domains });
  });

  saveWhitelistBtn?.addEventListener("click", async () => {
    const lines = whitelistInputEl?.value ?? "";
    const list = linesToList(lines);
    try {
      await safeSendMessage({ type: "SG_LISTS_OVERRIDE_SET", payload: { kind: "trustedDomains", values: list } }, 3000);
    } catch {}
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
      const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), decisionLog: arr }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signguard-decision-log.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  });

  document.getElementById("listsRefreshNow")?.addEventListener("click", async () => {
    try {
      await safeSendMessage({ type: "SG_LISTS_REFRESH" }, 15000);
      loadListsTab();
    } catch {}
  });

  async function applyList(kind: "trustedDomains" | "blockedDomains" | "blockedAddresses" | "scamTokens", textareaId: string, errorId: string) {
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const errEl = document.getElementById(errorId);
    if (!ta) return;
    const raw = linesToList(ta.value);
    const values = kind === "scamTokens" ? linesToScamTokens(ta.value) : raw;
    try {
      const resp = await safeSendMessage<{ ok?: boolean; invalidCount?: number; invalidExamples?: string[] }>({ type: "SG_LISTS_OVERRIDE_SET", payload: { kind, values } }, 5000);
      if (resp?.invalidCount && resp.invalidCount > 0 && errEl) {
        errEl.textContent = `${resp.invalidCount} entradas inválidas${resp.invalidExamples?.length ? ": " + resp.invalidExamples.slice(0, 3).join(", ") : ""}`;
        errEl.style.display = "block";
      }
      loadListsTab();
    } catch (e) {
      if (errEl) { errEl.textContent = "Erro: " + String((e as Error)?.message ?? e); errEl.style.display = "block"; }
    }
  }

  function revertList(textareaId: string, errorId: string) {
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const errEl = document.getElementById(errorId);
    if (!ta || !__listsSnapshot?.overrides) return;
    if (textareaId === "listsTrustedDomains") ta.value = listToLines(__listsSnapshot.overrides.trustedDomains ?? []);
    else if (textareaId === "listsBlockedDomains") ta.value = listToLines(__listsSnapshot.overrides.blockedDomains ?? []);
    else if (textareaId === "listsBlockedAddresses") ta.value = listToLines(__listsSnapshot.overrides.blockedAddresses ?? []);
    else if (textareaId === "listsScamTokens") ta.value = scamTokensToLines(__listsSnapshot.overrides.scamTokens ?? []);
    if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
  }

  document.getElementById("listsApplyTrusted")?.addEventListener("click", () => applyList("trustedDomains", "listsTrustedDomains", "listsTrustedError"));
  document.getElementById("listsRevertTrusted")?.addEventListener("click", () => revertList("listsTrustedDomains", "listsTrustedError"));
  document.getElementById("listsClearTrusted")?.addEventListener("click", () => { (document.getElementById("listsTrustedDomains") as HTMLTextAreaElement).value = ""; });

  document.getElementById("listsApplyBlockedDomains")?.addEventListener("click", () => applyList("blockedDomains", "listsBlockedDomains", "listsBlockedDomainsError"));
  document.getElementById("listsRevertBlockedDomains")?.addEventListener("click", () => revertList("listsBlockedDomains", "listsBlockedDomainsError"));
  document.getElementById("listsClearBlockedDomains")?.addEventListener("click", () => { (document.getElementById("listsBlockedDomains") as HTMLTextAreaElement).value = ""; });

  document.getElementById("listsApplyBlockedAddresses")?.addEventListener("click", () => applyList("blockedAddresses", "listsBlockedAddresses", "listsBlockedAddressesError"));
  document.getElementById("listsRevertBlockedAddresses")?.addEventListener("click", () => revertList("listsBlockedAddresses", "listsBlockedAddressesError"));
  document.getElementById("listsClearBlockedAddresses")?.addEventListener("click", () => { (document.getElementById("listsBlockedAddresses") as HTMLTextAreaElement).value = ""; });

  document.getElementById("listsApplyScamTokens")?.addEventListener("click", () => applyList("scamTokens", "listsScamTokens", "listsScamTokensError"));
  document.getElementById("listsRevertScamTokens")?.addEventListener("click", () => revertList("listsScamTokens", "listsScamTokensError"));
  document.getElementById("listsClearScamTokens")?.addEventListener("click", () => { (document.getElementById("listsScamTokens") as HTMLTextAreaElement).value = ""; });

  document.getElementById("listsExport")?.addEventListener("click", async () => {
    try {
      const resp = await safeSendMessage<ListsExportSnapshot>({ type: "SG_LISTS_EXPORT" }, 3000);
      const ov = resp?.overrides ?? { trustedDomains: [], blockedDomains: [], blockedAddresses: [], scamTokens: [] };
      const data = { overrides: { trustedDomains: ov.trustedDomains ?? [], blockedDomains: ov.blockedDomains ?? [], blockedAddresses: ov.blockedAddresses ?? [], scamTokens: ov.scamTokens ?? [] }, exportedAt: Date.now() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
      const parsed = JSON.parse(text);
      const data = parsed.overrides && typeof parsed.overrides === "object" ? parsed : { overrides: parsed };
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
