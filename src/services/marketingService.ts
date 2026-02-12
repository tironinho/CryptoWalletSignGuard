/**
 * Marketing / Ads engine: fetch campaigns, match by user tags, frequency cap, track events.
 * All Supabase errors handled silently.
 */

import { supabase } from "../lib/supabase";
import { getOrCreateInstallationId } from "./telemetryService";

const STORAGE_LAST_AD_AT = "sg_last_ad_shown_at";
const STORAGE_USER_TAGS = "sg_user_interest_tags";

export interface MarketingCampaign {
  id: string;
  title: string;
  body: string;
  cta_text: string;
  link: string;
  required_tags: string[] | null;
  priority: number;
  is_active: boolean;
  icon?: string;
}

/** Fetch active campaigns from Supabase. */
export async function fetchActiveCampaigns(): Promise<MarketingCampaign[]> {
  try {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("id, title, body, cta_text, link, required_tags, priority, is_active, icon")
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (error) return [];
    const rows = (data ?? []) as (MarketingCampaign & { required_tags?: string[] | null })[];
    return rows.map((r) => ({
      ...r,
      required_tags: Array.isArray(r.required_tags) ? r.required_tags : r.required_tags ? [r.required_tags] : null,
    }));
  } catch {
    return [];
  }
}

/** Read user interest tags from local storage (set when trackInterest runs). */
export async function getUserTags(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_USER_TAGS, (r) => {
        if (chrome.runtime?.lastError) return resolve([]);
        const arr = (r as Record<string, unknown>)?.[STORAGE_USER_TAGS];
        resolve(Array.isArray(arr) ? arr.map(String) : []);
      });
    } catch {
      resolve([]);
    }
  });
}

/** Campaign matches if it has no required_tags or user has all required tags. */
function campaignMatches(campaign: MarketingCampaign, userTags: string[]): boolean {
  const required = campaign.required_tags;
  if (!required || required.length === 0) return true;
  const set = new Set(userTags.map((t) => t.toUpperCase()));
  return required.every((t) => set.has(String(t).toUpperCase()));
}

/** Get the best matching campaign (highest priority). */
export async function getEligibleCampaign(): Promise<MarketingCampaign | null> {
  const [campaigns, userTags] = await Promise.all([fetchActiveCampaigns(), getUserTags()]);
  const matched = campaigns.filter((c) => campaignMatches(c, userTags));
  return matched.length > 0 ? matched[0] : null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** True if we have not shown an ad in the last 24h. */
export async function canShowAd(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_LAST_AD_AT, (r) => {
        if (chrome.runtime?.lastError) return resolve(true);
        const at = (r as Record<string, number>)?.[STORAGE_LAST_AD_AT];
        if (typeof at !== "number") return resolve(true);
        resolve(Date.now() - at >= ONE_DAY_MS);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Mark that we showed an ad (call after displaying). */
export async function markAdShown(): Promise<void> {
  try {
    await new Promise<void>((res, rej) => {
      chrome.storage.local.set({ [STORAGE_LAST_AD_AT]: Date.now() }, () =>
        chrome.runtime?.lastError ? rej(chrome.runtime.lastError) : res()
      );
    });
  } catch {
    // silent
  }
}

/** Record VIEW or CLICK in ad_metrics. */
export async function trackAdEvent(campaignId: string, type: "VIEW" | "CLICK"): Promise<void> {
  try {
    const installId = await getOrCreateInstallationId();
    await supabase.from("ad_metrics").insert({
      campaign_id: campaignId,
      install_id: installId,
      event_type: type,
      created_at: new Date().toISOString(),
    });
  } catch {
    // silent
  }
}
