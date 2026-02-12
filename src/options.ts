import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { normalizeDomainLine } from "./shared/utils";
import { t } from "./i18n";
import { SUGGESTED_TRUSTED_DOMAINS } from "./shared/constants";
import { safeSendMessage, safeStorageGet, safeStorageSet, safeLocalGet } from "./runtimeSafe";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DEBUG_KEY = "sg_debug_events";
const HISTORY_KEY = "sg_history";

type TabName = "settings" | "history" | "plan";

function showTab(name: TabName) {
  const tabs = document.querySelectorAll(".tab-btn");
  for (let i = 0; i < tabs.length; i++) {
    const b = tabs[i] as HTMLElement;
    b.classList.toggle("active", b.getAttribute("data-tab") === name);
  }
  const panels = document.querySelectorAll(".tab-panel");
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i] as HTMLElement;
    p.classList.toggle("active", p.id === `tab-${name}`);
  }
  if (name === "history") loadHistory();
  if (name === "plan") loadPlan();
}

async function loadPlan() {
  const tierEl = $("planTierDisplay");
  const statusEl = $("planActivateStatus");
  if (statusEl) { statusEl.classList.add("hidden"); statusEl.textContent = ""; }
  try {
    const resp = await safeSendMessage<{ ok?: boolean; plan?: { tier: string } }>({ type: "SG_GET_PLAN" }, 2000);
    const tier = resp?.ok && resp?.plan?.tier ? resp.plan.tier : "FREE";
    if (tierEl) tierEl.textContent = tier;
  } catch {
    if (tierEl) tierEl.textContent = "FREE";
  }
}

async function loadHistory() {
  const listEl = $("historyList");
  if (!listEl) return;
  const items = await localGet<any[]>(HISTORY_KEY);
  const arr = Array.isArray(items) ? items.slice().reverse() : [];
  if (arr.length === 0) {
    listEl.innerHTML = `<p class="muted">${t("historyEmpty") || "Nenhum registro."}</p>`;
    return;
  }
  listEl.innerHTML = arr.map((e) => {
    const ts = e.ts ? new Date(e.ts).toLocaleString() : "—";
    const host = e.host || "—";
    const action = e.action || e.method || "—";
    const decision = e.decision === "ALLOW" ? (t("decision_allow") || "Permitido") : (t("decision_block") || "Bloqueado");
    const score = e.score != null ? String(e.score) : "";
    const value = e.valueEth ? ` ${e.valueEth} ETH` : "";
    return `<div class="history-card"><div class="meta">${ts} · ${host}</div><div>${action} · ${decision}${score ? " · " + score : ""}${value}</div></div>`;
  }).join("");
}

function applyI18n(root: ParentNode = document) {
  const nodes = root.querySelectorAll<HTMLElement>("[data-i18n]");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const key = el.getAttribute("data-i18n");
    if (!key) continue;
    el.textContent = t(key);
  }
}

async function load(): Promise<Settings> {
  const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
  return r.ok ? (r.data as Settings) : DEFAULT_SETTINGS;
}

async function save(s: Settings) {
  await safeStorageSet(s as unknown as Record<string, unknown>);
}


function localGet<T = any>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) return resolve(null);
      chrome.storage.local.get(key, (r) => {
        const err = chrome.runtime?.lastError;
        if (err) return resolve(null);
        resolve(((r as any)?.[key] as T) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function downloadJson(filename: string, data: any) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

function fmtDate(ts: number | null | undefined) {
  if (!ts || !Number.isFinite(ts)) return t("dash");
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

async function refreshIntelSummary() {
  const resp = await safeSendMessage<any>({ type: "SG_INTEL_SUMMARY" }, 3000);
  if (!resp?.ok) {
    $("intelTrustedCount").textContent = t("dash");
    $("intelBlockedCount").textContent = t("dash");
    const addrEl = document.getElementById("intelBlockedAddressCount");
    if (addrEl) addrEl.textContent = t("dash");
    $("intelUpdatedAt").textContent = t("dash");
    return;
  }
  $("intelTrustedCount").textContent = String(resp.trustedSeedCount ?? "—");
  $("intelBlockedCount").textContent = String(resp.blockedCount ?? "—");
  const addrEl = document.getElementById("intelBlockedAddressCount");
  if (addrEl) addrEl.textContent = String(resp.blockedAddressCount ?? "—");
  $("intelUpdatedAt").textContent = fmtDate(resp.updatedAt);
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

function normalizeContractAddress(addr: string): string | null {
  const s = String(addr || "").trim();
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  if (hex.length !== 40 || !/^[a-fA-F0-9]{40}$/.test(hex)) return null;
  return "0x" + hex.toLowerCase();
}

function renderVaultList(locked: string[]) {
  const listEl = $("vaultList");
  const emptyEl = $("vaultListEmpty");
  if (!listEl) return;
  if (!locked.length) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.style.display = "block";
    }
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";
  listEl.innerHTML = locked
    .map(
      (addr, i) =>
        `<li class="history-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <code style="font-size:12px;word-break:break-all;">${escapeHtml(addr)}</code>
          <button type="button" class="vault-remove" data-index="${i}" style="background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;">${t("vaultRemove")}</button>
        </li>`
    )
    .join("");
  listEl.querySelectorAll(".vault-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const idx = parseInt((btn as HTMLElement).getAttribute("data-index") ?? "-1", 10);
      if (idx < 0) return;
      const s = await load();
      const list = [...(s.vault?.lockedContracts ?? [])];
      list.splice(idx, 1);
      await save({ ...s, vault: { enabled: s.vault?.enabled ?? false, lockedContracts: list } });
      renderVaultList(list);
    });
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

(async function init() {
  const s = await load();

  const container = document.getElementById("options-container");
  if (container) {
    const urlParams = new URLSearchParams(location.search);
    const showWelcome = urlParams.get("welcome") === "true" || !(s.simulation?.tenderlyKey ?? "").trim();
    if (showWelcome) {
      const banner = document.createElement("div");
      banner.id = "welcome-banner";
      banner.className = "bg-blue-900 border-l-4 border-blue-500 text-blue-100 p-4 mb-6 rounded shadow-lg";
      banner.innerHTML = `<p class="font-bold text-lg">Bem-vindo ao SignGuard! 🛡️</p>
<p>Para ativar a Simulação de Transações (que previne drenagem de carteira), você precisa de uma chave gratuita da Tenderly.</p>
<p class="text-sm mt-2 opacity-75">Configure abaixo na aba "Simulação".</p>`;
      container.insertBefore(banner, container.firstChild);
    }
  }

  applyI18n();
  document.title = t("optionsTitle");
  const modeEl = $("mode") as HTMLSelectElement;
  modeEl.value = s.mode || "BALANCED";
  if (!modeEl.querySelector(`option[value="${modeEl.value}"]`)) modeEl.value = "BALANCED";
  ($("riskWarnings") as HTMLInputElement).checked = s.riskWarnings ?? true;
  ($("showConnectOverlay") as HTMLInputElement).checked = s.showConnectOverlay;
  ($("blockHighRisk") as HTMLInputElement).checked = s.blockHighRisk;
  ($("requireTypedOverride") as HTMLInputElement).checked = (s.requireTypedOverride ?? true);
  ($("allowOverrideOnPhishing") as HTMLInputElement).checked = (s.allowOverrideOnPhishing ?? false);
  ($("strictBlockApprovalsUnlimited") as HTMLInputElement).checked = (s.strictBlockApprovalsUnlimited ?? true);
  ($("strictBlockSetApprovalForAll") as HTMLInputElement).checked = (s.strictBlockSetApprovalForAll ?? true);
  ($("strictBlockPermitLike") as HTMLInputElement).checked = (s.strictBlockPermitLike ?? true);
  ($("assetEnrichmentEnabled") as HTMLInputElement).checked = (s.assetEnrichmentEnabled ?? true);
  ($("addressIntelEnabled") as HTMLInputElement).checked = (s.addressIntelEnabled ?? true);
  ($("cloudIntelOptIn") as HTMLInputElement).checked = (s.cloudIntelOptIn ?? false);
  ($("showUsd") as HTMLInputElement).checked = (s.showUsd ?? true);
  ($("debugMode") as HTMLInputElement).checked = (s.debugMode ?? false);
  ($("domainChecks") as HTMLInputElement).checked = s.domainChecks;
  ($("enableIntel") as HTMLInputElement).checked = s.enableIntel !== false;
  ($("vaultEnabled") as HTMLInputElement).checked = s.vault?.enabled ?? false;
  renderVaultList(s.vault?.lockedContracts ?? []);
  const sim = s.simulation ?? { enabled: false, tenderlyAccount: "", tenderlyProject: "", tenderlyKey: "" };
  ($("simulationEnabled") as HTMLInputElement).checked = sim.enabled ?? false;
  ($("simulationTenderlyAccount") as HTMLInputElement).value = sim.tenderlyAccount ?? "";
  ($("simulationTenderlyProject") as HTMLInputElement).value = sim.tenderlyProject ?? "";
  ($("simulationTenderlyKey") as HTMLInputElement).value = sim.tenderlyKey ?? "";
  const simulationBanner = $("simulationBanner");
  if (simulationBanner) {
    const keysEmpty = !(sim.tenderlyAccount ?? "").trim() && !(sim.tenderlyProject ?? "").trim() && !(sim.tenderlyKey ?? "").trim();
    simulationBanner.classList.toggle("hidden", !keysEmpty);
  }
  const domains = (s.trustedDomains && Array.isArray(s.trustedDomains) && s.trustedDomains.length) ? s.trustedDomains : s.allowlist;
  ($("allowlist") as HTMLTextAreaElement).value = listToLines(domains);
  ($("customTrustedDomains") as HTMLTextAreaElement).value = listToLines(s.customTrustedDomains || []);
  ($("customBlockedDomains") as HTMLTextAreaElement).value = listToLines(s.customBlockedDomains || []);

  const planTierEl = $("planTierDisplay");
  if (planTierEl) planTierEl.textContent = s.planTier || "FREE";
  const licenseInput = $("licenseKey") as HTMLInputElement;
  if (licenseInput) licenseInput.value = s.licenseKey || "";

  const hash = (location.hash || "").replace(/^#/, "") || "settings";
  const tabName = hash === "history" ? "history" : hash === "plan" ? "plan" : "settings";
  showTab(tabName);

  const tabBtns = document.querySelectorAll(".tab-btn");
  for (let i = 0; i < tabBtns.length; i++) {
    const btn = tabBtns[i] as HTMLElement;
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab") as TabName;
      if (t) {
        location.hash = t;
        showTab(t);
      }
    });
  }
  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").replace(/^#/, "") || "settings";
    showTab(h === "history" ? "history" : h === "plan" ? "plan" : "settings");
  });

  $("save").addEventListener("click", async () => {
    const latest = await load();
    const next: Settings = {
      riskWarnings: ($("riskWarnings") as HTMLInputElement).checked,
      mode: (($("mode") as HTMLSelectElement).value || "BALANCED") as any,
      showConnectOverlay: ($("showConnectOverlay") as HTMLInputElement).checked,
      blockHighRisk: ($("blockHighRisk") as HTMLInputElement).checked,
      requireTypedOverride: ($("requireTypedOverride") as HTMLInputElement).checked,
      allowOverrideOnPhishing: ($("allowOverrideOnPhishing") as HTMLInputElement).checked,
      strictBlockApprovalsUnlimited: ($("strictBlockApprovalsUnlimited") as HTMLInputElement).checked,
      strictBlockSetApprovalForAll: ($("strictBlockSetApprovalForAll") as HTMLInputElement).checked,
      strictBlockPermitLike: ($("strictBlockPermitLike") as HTMLInputElement).checked,
      assetEnrichmentEnabled: ($("assetEnrichmentEnabled") as HTMLInputElement).checked,
      addressIntelEnabled: ($("addressIntelEnabled") as HTMLInputElement).checked,
      cloudIntelOptIn: ($("cloudIntelOptIn") as HTMLInputElement).checked,
      showUsd: ($("showUsd") as HTMLInputElement).checked,
      debugMode: ($("debugMode") as HTMLInputElement).checked,
      domainChecks: ($("domainChecks") as HTMLInputElement).checked,
      enableIntel: ($("enableIntel") as HTMLInputElement)?.checked !== false,
      allowlist: linesToList(($("allowlist") as HTMLTextAreaElement).value),
      trustedDomains: linesToList(($("allowlist") as HTMLTextAreaElement).value),
      customTrustedDomains: linesToList(($("customTrustedDomains") as HTMLTextAreaElement)?.value || ""),
      customBlockedDomains: linesToList(($("customBlockedDomains") as HTMLTextAreaElement)?.value || ""),
      planTier: s.planTier || "FREE",
      licenseKey: (($("licenseKey") as HTMLInputElement)?.value || "").trim(),
      vault: {
        enabled: ($("vaultEnabled") as HTMLInputElement)?.checked ?? false,
        lockedContracts: latest.vault?.lockedContracts ?? [],
      },
      simulation: {
        enabled: ($("simulationEnabled") as HTMLInputElement)?.checked ?? false,
        tenderlyAccount: (($("simulationTenderlyAccount") as HTMLInputElement)?.value ?? "").trim(),
        tenderlyProject: (($("simulationTenderlyProject") as HTMLInputElement)?.value ?? "").trim(),
        tenderlyKey: (($("simulationTenderlyKey") as HTMLInputElement)?.value ?? "").trim(),
      },
      pausedUntil: latest.pausedUntil,
      whitelistedDomains: latest.whitelistedDomains ?? [],
    };
    await save(next);
    const st = $("status");
    st.style.opacity = "1";
    setTimeout(() => (st.style.opacity = "0"), 1200);
    const simBanner = $("simulationBanner");
    if (simBanner && next.simulation) {
      const keysEmpty = !next.simulation.tenderlyAccount?.trim() && !next.simulation.tenderlyProject?.trim() && !next.simulation.tenderlyKey?.trim();
      simBanner.classList.toggle("hidden", !keysEmpty);
    }
  });

  $("exportLists")?.addEventListener("click", () => {
    const trusted = linesToList(($("customTrustedDomains") as HTMLTextAreaElement)?.value || "");
    const blocked = linesToList(($("customBlockedDomains") as HTMLTextAreaElement)?.value || "");
    downloadJson("signguard-custom-lists.json", {
      exportedAt: Date.now(),
      customTrustedDomains: trusted,
      customBlockedDomains: blocked,
    });
  });

  $("addSuggested").addEventListener("click", async () => {
    const latest = await load();
    const current = linesToList(($("allowlist") as HTMLTextAreaElement).value);
    const merged = Array.from(new Set([...current, ...SUGGESTED_TRUSTED_DOMAINS.map((d) => normalizeDomainLine(d))])).filter(Boolean);
    merged.sort();
    ($("allowlist") as HTMLTextAreaElement).value = listToLines(merged);
    const next: Settings = {
      ...latest,
      riskWarnings: ($("riskWarnings") as HTMLInputElement).checked,
      mode: (($("mode") as HTMLSelectElement).value || "BALANCED") as any,
      showConnectOverlay: ($("showConnectOverlay") as HTMLInputElement).checked,
      blockHighRisk: ($("blockHighRisk") as HTMLInputElement).checked,
      requireTypedOverride: ($("requireTypedOverride") as HTMLInputElement).checked,
      allowOverrideOnPhishing: ($("allowOverrideOnPhishing") as HTMLInputElement).checked,
      strictBlockApprovalsUnlimited: ($("strictBlockApprovalsUnlimited") as HTMLInputElement).checked,
      strictBlockSetApprovalForAll: ($("strictBlockSetApprovalForAll") as HTMLInputElement).checked,
      strictBlockPermitLike: ($("strictBlockPermitLike") as HTMLInputElement).checked,
      assetEnrichmentEnabled: ($("assetEnrichmentEnabled") as HTMLInputElement).checked,
      addressIntelEnabled: ($("addressIntelEnabled") as HTMLInputElement).checked,
      cloudIntelOptIn: ($("cloudIntelOptIn") as HTMLInputElement).checked,
      showUsd: ($("showUsd") as HTMLInputElement).checked,
      debugMode: ($("debugMode") as HTMLInputElement).checked,
      domainChecks: ($("domainChecks") as HTMLInputElement).checked,
      allowlist: merged,
      trustedDomains: merged,
    };
    await save(next);
    const st = $("status");
    st.style.opacity = "1";
    setTimeout(() => (st.style.opacity = "0"), 1200);
  });

  $("vaultAdd")?.addEventListener("click", async () => {
    const input = $<HTMLInputElement>("vaultContractInput");
    const raw = (input?.value ?? "").trim();
    const addr = normalizeContractAddress(raw);
    if (!addr) {
      alert(t("vaultInvalidAddress") || "Endereço inválido. Use 0x + 40 caracteres hex.");
      return;
    }
    const s = await load();
    const list = [...(s.vault?.lockedContracts ?? [])];
    if (list.includes(addr)) {
      alert(t("vaultAlreadyAdded") || "Este contrato já está no cofre.");
      return;
    }
    list.push(addr);
    await save({ ...s, vault: { enabled: s.vault?.enabled ?? false, lockedContracts: list } });
    renderVaultList(list);
    if (input) input.value = "";
  });

  await refreshIntelSummary();
  $("intelUpdateNow")?.addEventListener("click", async () => {
    const resp = await safeSendMessage<any>({ type: "SG_INTEL_UPDATE_NOW" }, 3000);
    if (resp?.ok) {
      $("intelTrustedCount").textContent = String(resp.trustedSeedCount ?? "—");
      $("intelBlockedCount").textContent = String(resp.blockedCount ?? "—");
      const addrEl = document.getElementById("intelBlockedAddressCount");
      if (addrEl) addrEl.textContent = String(resp.blockedAddressCount ?? "—");
      $("intelUpdatedAt").textContent = fmtDate(resp.updatedAt);
    } else {
      await refreshIntelSummary();
    }
  });

  $("historyExport")?.addEventListener("click", async () => {
    const items = await localGet<any[]>(HISTORY_KEY);
    const arr = Array.isArray(items) ? items : [];
    downloadJson("signguard-history.json", { exportedAt: Date.now(), history: arr });
  });

  $("historyClear")?.addEventListener("click", async () => {
    try {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [HISTORY_KEY]: [] }, () => resolve());
      });
      loadHistory();
    } catch {}
  });

  $("planActivate")?.addEventListener("click", async () => {
    const input = $("licenseKey") as HTMLInputElement;
    const key = (input?.value ?? "").trim();
    const statusEl = $("planActivateStatus");
    if (statusEl) { statusEl.classList.remove("hidden"); statusEl.textContent = key ? "A ativar…" : "Introduza uma chave."; }
    if (!key) return;
    try {
      const resp = await safeSendMessage<{ ok?: boolean; tier?: string; invalid?: boolean }>({ type: "SG_ACTIVATE_LICENSE", payload: { key } }, 3000);
      if (resp?.ok) {
        if (statusEl) statusEl.textContent = resp.invalid ? "Chave inválida (use CSG-… com mais de 15 caracteres)." : "Ativado: " + (resp.tier || "PRO") + ".";
        await loadPlan();
      } else {
        if (statusEl) statusEl.textContent = "Erro ao ativar.";
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = "Erro: " + String((e as Error)?.message ?? e);
    }
  });

  $("goPro")?.addEventListener("click", () => {
    try { window.open("https://example.com", "_blank"); } catch {}
  });

  $("exportDebug")?.addEventListener("click", async () => {
    const debugOn = ($("debugMode") as HTMLInputElement)?.checked;
    if (!debugOn) {
      alert(t("exportDebugRequiresDebugMode") || "Enable Debug Mode first to export events.");
      return;
    }
    const raw = await safeLocalGet<unknown[]>(DEBUG_KEY);
    const arr = Array.isArray(raw) ? raw.slice(-20) : [];
    const sanitized = arr.map((e: any) => {
      if (!e || typeof e !== "object") return { ts: 0, kind: "unknown" };
      return {
        ts: e.ts,
        kind: e.kind,
        method: e.method,
        host: e.host ? String(e.host).slice(0, 64) : undefined,
        level: e.level,
        score: e.score,
        recommend: e.recommend,
        intent: e.intent,
        isPhishing: !!e.isPhishing,
      };
    });
    downloadJson("signguard-debug-events.json", {
      exportedAt: Date.now(),
      debugMode: true,
      events: sanitized,
    });
  });
})();
