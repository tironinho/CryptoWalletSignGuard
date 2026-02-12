import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { safeStorageGet, safeStorageSet } from "./runtimeSafe";
import { t } from "./i18n";

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

const PAUSE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

(async function init() {
  const statusEl = $("popupStatus");
  const pausedBlock = $("popupPausedBlock");
  const pauseWrap = $("popupPauseWrap");
  const pauseBtn15m = $("popupPause15m");
  const resumeBtn = $("popupResume");
  const linkSettings = $("linkSettings");
  const linkHistory = $("linkHistory");
  const linkPlan = $("linkPlan");

  const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
  let s: Settings = r.ok ? (r.data as Settings) : DEFAULT_SETTINGS;

  const now = Date.now();
  const isPaused = typeof s.pausedUntil === "number" && s.pausedUntil > now;

  if (pausedBlock) pausedBlock.classList.toggle("hidden", !isPaused);
  if (pauseWrap) pauseWrap.classList.toggle("hidden", !!isPaused);
  if (statusEl) statusEl.textContent = isPaused ? (t("popupStatusPaused") || "Pausado") : (t("popupStatusProtected") || "Protegido");

  resumeBtn?.addEventListener("click", async () => {
    const next = { ...s, pausedUntil: undefined };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
    if (pausedBlock) pausedBlock.classList.add("hidden");
    if (pauseWrap) pauseWrap.classList.remove("hidden");
    if (statusEl) statusEl.textContent = t("popupStatusProtected") || "Protegido";
  });

  pauseBtn15m?.addEventListener("click", async () => {
    const next = { ...s, pausedUntil: Date.now() + PAUSE_DURATION_MS };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    s = next;
    if (pausedBlock) pausedBlock.classList.remove("hidden");
    if (pauseWrap) pauseWrap.classList.add("hidden");
    if (statusEl) statusEl.textContent = t("popupStatusPaused") || "Pausado";
  });

  linkSettings?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open("options.html", "_blank");
      }
      window.close();
    } catch {
      window.close();
    }
  });

  linkHistory?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const url = typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("options.html#history")
        : "options.html#history";
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, "_blank");
      }
      window.close();
    } catch {
      window.close();
    }
  });

  linkPlan?.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const url = typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("options.html#plan")
        : "options.html#plan";
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, "_blank");
      }
      window.close();
    } catch {
      window.close();
    }
  });
})();
