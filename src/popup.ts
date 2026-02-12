import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { safeStorageGet, safeStorageSet } from "./runtimeSafe";
import { t } from "./i18n";

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

function openOptionsHash(hash: string) {
  try {
    const base = chrome.runtime.getURL("options.html");
    const url = hash ? base + (hash.startsWith("#") ? hash : "#" + hash) : base;
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
    window.close();
  } catch {
    chrome.runtime.openOptionsPage?.();
    window.close();
  }
}

(async function init() {
  const titleEl = $("popupTitle");
  const modeEl = $("popupMode");
  const modeSelect = $("popupModeSelect") as HTMLSelectElement;
  const showUsdCb = $("popupShowUsd") as HTMLInputElement;
  const showUsdLabel = $("popupShowUsdLabel");
  const modeLabel = $("popupModeLabel");

  if (titleEl) titleEl.textContent = t("extName") || "SignGuard";
  if (modeLabel) modeLabel.textContent = t("modeLabel") || "Mode";
  if (showUsdLabel) showUsdLabel.textContent = t("showUsdLabel") || "Show USD";
  const pauseLabelEl = $("popupPauseLabel");
  const statusEl = $("popupStatus");
  const footerEl = $("popupFooter");
  if (pauseLabelEl) pauseLabelEl.textContent = t("popupPauseProtection") || "PAUSAR PROTEÇÃO";

  const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
  let s: Settings = r.ok ? (r.data as Settings) : DEFAULT_SETTINGS;

  const pausedBlock = $("popupPausedBlock");
  const pauseWrap = $("popupPauseWrap");
  const pausedText = $("popupPausedText");
  const now = Date.now();
  const isPaused = typeof s.pausedUntil === "number" && s.pausedUntil > now;
  if (pausedBlock) pausedBlock.classList.toggle("hidden", !isPaused);
  if (pauseWrap) pauseWrap.classList.toggle("hidden", !!isPaused);
  if (footerEl) footerEl.classList.toggle("status-paused", isPaused);
  if (statusEl) statusEl.textContent = isPaused ? (t("popupStatusPaused") || "Pausado") : (t("popupStatusProtected") || "Protegido");
  if (pausedText && isPaused && s.pausedUntil != null) {
    pausedText.textContent = "Proteção pausada até " + new Date(s.pausedUntil).toLocaleString();
  }

  $("popupResume")?.addEventListener("click", async () => {
    const next = { ...s, pausedUntil: undefined };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
    if (pausedBlock) pausedBlock.classList.add("hidden");
    if (pauseWrap) pauseWrap.classList.remove("hidden");
    if (footerEl) footerEl.classList.remove("status-paused");
    if (statusEl) statusEl.textContent = t("popupStatusProtected") || "Protegido";
    if (modeEl) modeEl.textContent = `${t("modeLabel") || "Mode"}: ${s.mode || "BALANCED"}`;
  });

  $("popupPause1h")?.addEventListener("click", async () => {
    const next = { ...s, pausedUntil: Date.now() + 60 * 60 * 1000 };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
    if (pausedBlock) pausedBlock.classList.remove("hidden");
    if (pauseWrap) pauseWrap.classList.add("hidden");
    if (footerEl) footerEl.classList.add("status-paused");
    if (statusEl) statusEl.textContent = t("popupStatusPaused") || "Pausado";
    if (pausedText) pausedText.textContent = "Proteção pausada até " + new Date(next.pausedUntil!).toLocaleString();
  });

  if (modeEl) modeEl.textContent = `${t("modeLabel") || "Mode"}: ${s.mode || "BALANCED"}`;
  if (modeSelect) modeSelect.value = s.mode || "BALANCED";
  if (showUsdCb) showUsdCb.checked = s.showUsd !== false;

  const fortressCb = $("popupFortress") as HTMLInputElement;
  const fortressLabel = $("popupFortressLabel");
  const fortressDesc = $("popupFortressDesc");
  if (fortressCb) fortressCb.checked = s.fortressMode === true;
  if (fortressLabel) fortressLabel.textContent = t("fortressModeLabel") || "MODO FORTALEZA";
  if (fortressDesc) fortressDesc.textContent = t("fortressModeDesc") || "Bloqueia todas as aprovações de tokens, exceto em sites confiáveis.";

  fortressCb?.addEventListener("change", async () => {
    const next = { ...s, fortressMode: fortressCb.checked };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
  });

  modeSelect?.addEventListener("change", async () => {
    const next = { ...s, mode: (modeSelect.value || "BALANCED") as Settings["mode"] };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
    if (modeEl) modeEl.textContent = `${t("modeLabel") || "Mode"}: ${next.mode}`;
  });

  showUsdCb?.addEventListener("change", async () => {
    const next = { ...s, showUsd: showUsdCb.checked };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
  });

  $("popupOptions")?.addEventListener("click", () => {
    try {
      chrome.runtime.openOptionsPage?.();
    } catch {}
    window.close();
  });

  $("popupHistory")?.addEventListener("click", () => openOptionsHash("#history"));
  $("popupPlan")?.addEventListener("click", () => openOptionsHash("#plan"));
})();
