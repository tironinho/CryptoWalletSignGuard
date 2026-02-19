/**
 * Onboarding: welcome, terms acceptance, and optional Cloud Intel / Telemetria (default OFF).
 * On accept: set termsAccepted, save cloudIntelOptIn and telemetryOptIn from checkboxes,
 * request optional permissions only if Cloud Intel is checked; then open Options.
 */

import { DEFAULT_SETTINGS } from "./shared/types";
import type { Settings } from "./shared/types";
import { safeStorageSet } from "./runtimeSafe";
import { requestOptionalHostPermissions } from "./permissions";

const acceptBtn = document.getElementById("sgOnbAccept");
const refuseBtn = document.getElementById("sgOnbRefuse");
const onbCloudIntel = document.getElementById("onbCloudIntel") as HTMLInputElement | null;
const onbTelemetry = document.getElementById("onbTelemetry") as HTMLInputElement | null;
const onbMessage = document.getElementById("onbMessage") as HTMLElement | null;

function showMessage(text: string, isError = false) {
  if (!onbMessage) return;
  onbMessage.textContent = text;
  onbMessage.classList.toggle("sg-onb-message--error", isError);
  onbMessage.style.display = text ? "block" : "none";
}

async function onAccept() {
  if (!acceptBtn) return;
  (acceptBtn as HTMLButtonElement).disabled = true;
  showMessage("");

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        { termsAccepted: true, installDate: Date.now() },
        () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve())
      );
    });

    const cloudIntel = onbCloudIntel?.checked === true;
    const telemetry = onbTelemetry?.checked === true;

    const current = await new Promise<Settings>((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => {
        resolve((r as Settings) ?? DEFAULT_SETTINGS);
      });
    });

    let cloudIntelFinal = false;
    if (cloudIntel) {
      const granted = await requestOptionalHostPermissions("cloudIntel");
      if (!granted) {
        showMessage("Sem permissões, Cloud Intel permanecerá desativado. Você pode ativar depois em Configurações.", true);
      } else {
        cloudIntelFinal = true;
      }
    }

    let telemetryFinal = false;
    if (telemetry) {
      const granted = await requestOptionalHostPermissions("telemetry");
      if (!granted) {
        showMessage("Sem permissões, telemetria permanecerá desativada. Você pode ativar depois em Configurações.", true);
      } else {
        telemetryFinal = true;
      }
    }

    const next: Settings = {
      ...current,
      cloudIntelOptIn: cloudIntelFinal,
      telemetryOptIn: telemetryFinal,
    };
    await safeStorageSet(next as unknown as Record<string, unknown>);
  } catch {
    showMessage("Erro ao salvar. Tente novamente em Configurações.", true);
    (acceptBtn as HTMLButtonElement).disabled = false;
    return;
  }

  try {
    if (typeof chrome.runtime?.openOptionsPage === "function") {
      chrome.runtime.openOptionsPage();
    } else {
      const url = typeof chrome.runtime?.getURL === "function"
        ? chrome.runtime.getURL("options.html")
        : "options.html";
      if (typeof chrome?.tabs?.create === "function") {
        chrome.tabs.create({ url });
      } else {
        window.location.href = url;
      }
    }
    try {
      window.close();
    } catch {}
  } catch {
    const url = typeof chrome.runtime?.getURL === "function"
      ? chrome.runtime.getURL("options.html")
      : "options.html";
    window.location.href = url;
  }
}

function onRefuse() {
  if (!refuseBtn) return;
  (refuseBtn as HTMLButtonElement).disabled = true;
  try {
    if (typeof chrome?.runtime?.getURL === "function") {
      chrome.tabs.create?.({ url: "chrome://extensions/?id=" + chrome.runtime.id });
    }
  } catch {
    window.open("chrome://extensions/", "_blank");
  }
  try {
    window.close();
  } catch {}
}

acceptBtn?.addEventListener("click", () => void onAccept());
refuseBtn?.addEventListener("click", () => onRefuse());
