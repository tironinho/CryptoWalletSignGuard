/**
 * Marketing toast: floating card (Shadow DOM) bottom-right, dark mode, neon border.
 * Shown as "Dica de Segurança" / "Oportunidade" style. No alert().
 */

export interface AdToastCampaign {
  id: string;
  title: string;
  body: string;
  cta_text: string;
  link: string;
  icon?: string;
}

const TOAST_ID = "sg-ad-toast-root";

export function renderAdToast(
  campaign: AdToastCampaign,
  onClose: () => void,
  onCtaClick: () => void
): void {
  try {
    if (document.getElementById(TOAST_ID)) return;
    const host = document.createElement("div");
    host.id = TOAST_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      .card {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        max-width: calc(100vw - 40px);
        background: #1e293b;
        border: 1px solid rgba(59, 130, 246, 0.4);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        border-radius: 12px;
        padding: 16px;
        font-family: system-ui, -apple-system, sans-serif;
        color: #f8fafc;
        z-index: 2147483646;
        animation: sgFadeIn 0.35s ease-out;
      }
      @keyframes sgFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .title { font-size: 0.95rem; font-weight: 600; margin: 0; line-height: 1.3; }
      .close {
        flex-shrink: 0;
        width: 28px; height: 28px;
        border: none;
        background: rgba(148, 163, 184, 0.2);
        color: #94a3b8;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        display: flex; align-items: center; justify-content: center;
      }
      .close:hover { background: rgba(148, 163, 184, 0.35); color: #f8fafc; }
      .body { font-size: 0.8rem; color: #94a3b8; line-height: 1.45; margin: 0 0 14px 0; }
      .cta {
        display: inline-block;
        padding: 8px 14px;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.85rem; font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .cta:hover { background: #2563eb; }
      .icon { font-size: 1.25rem; margin-right: 6px; }
    `;
    shadow.appendChild(style);
    const card = document.createElement("div");
    card.className = "card";
    const icon = (campaign.icon || "🛡️").slice(0, 2);
    card.innerHTML = `
      <div class="head">
        <h3 class="title"><span class="icon">${escapeHtml(icon)}</span>${escapeHtml(campaign.title)}</h3>
        <button type="button" class="close" aria-label="Fechar">×</button>
      </div>
      <p class="body">${escapeHtml(campaign.body)}</p>
      <a href="${escapeHtml(campaign.link)}" target="_blank" rel="noopener noreferrer" class="cta">${escapeHtml(campaign.cta_text)}</a>
    `;
    shadow.appendChild(card);
    const closeBtn = shadow.querySelector(".close");
    const ctaEl = shadow.querySelector(".cta");
    closeBtn?.addEventListener("click", () => {
      host.remove();
      onClose();
    });
    ctaEl?.addEventListener("click", (e) => {
      onCtaClick();
    });
    document.documentElement.appendChild(host);
  } catch {
    // must not break page
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function dismissAdToast(): void {
  try {
    document.getElementById(TOAST_ID)?.remove();
  } catch {}
}
