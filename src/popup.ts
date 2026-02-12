import type { Settings } from "./shared/types";
import { DEFAULT_SETTINGS } from "./shared/types";
import { safeStorageGet, safeStorageSet } from "./runtimeSafe";
import { t } from "./i18n";

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

function openOptionsHash(hash: string) {
  try {
    const url = chrome.runtime.getURL(`options.html${hash}`);
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

  const r = await safeStorageGet<Settings>(DEFAULT_SETTINGS);
  const s: Settings = r.ok ? (r.data as Settings) : DEFAULT_SETTINGS;

  if (modeEl) modeEl.textContent = `${t("modeLabel") || "Mode"}: ${s.mode || "BALANCED"}`;
  if (modeSelect) modeSelect.value = s.mode || "BALANCED";
  if (showUsdCb) showUsdCb.checked = s.showUsd !== false;

  modeSelect?.addEventListener("change", async () => {
    const next = { ...s, mode: (modeSelect.value || "BALANCED") as Settings["mode"] };
    await safeStorageSet(next as unknown as Record<string, unknown>);
    if (modeEl) modeEl.textContent = `${t("modeLabel") || "Mode"}: ${next.mode}`;
  });

  showUsdCb?.addEventListener("change", async () => {
    const next = { ...s, showUsd: showUsdCb.checked };
    await safeStorageSet(next as unknown as Record<string, unknown>);
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
