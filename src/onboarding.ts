/**
 * Onboarding: welcome screen and terms acceptance.
 * On accept: persist termsAccepted, set cloudIntelOptIn, call registerUser(), redirect to options.
 */

import { DEFAULT_SETTINGS } from "./shared/types";
import type { Settings } from "./shared/types";
import { telemetry } from "./services/telemetryService";

const acceptBtn = document.getElementById("sgOnbAccept");
const refuseBtn = document.getElementById("sgOnbRefuse");

async function onAccept() {
  if (!acceptBtn) return;
  acceptBtn.disabled = true;
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        { termsAccepted: true, installDate: Date.now() },
        () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve())
      );
    });
    const current = await new Promise<Settings>((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (r) => {
        resolve((r as Settings) ?? DEFAULT_SETTINGS);
      });
    });
    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set(
        { ...current, cloudIntelOptIn: true },
        () => (chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve())
      );
    });
    await telemetry.registerUser();
  } catch {
    // continue to redirect
  }
  try {
    const url = typeof chrome.runtime?.getURL === "function"
      ? chrome.runtime.getURL("options.html")
      : "options.html";
    if (typeof chrome?.tabs?.getCurrent === "function") {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id != null && chrome.tabs?.update) {
          chrome.tabs.update(tab.id, { url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  } catch {
    window.location.href = "options.html";
  }
}

function onRefuse() {
  if (!refuseBtn) return;
  refuseBtn.disabled = true;
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
