import { SHEET_URLS, FREE_DELIVERY_TARGET } from './config.js';
import { parseCSV } from './sheet.js';

async function loadBannerSettings() {
  const groups = document.querySelectorAll('.banner .tick-group');
  if (!groups.length || !SHEET_URLS.settings) return;

  const fallback = [...groups[0].querySelectorAll('span')].map(span => span.textContent.trim());

  try {
    const response = await fetch(SHEET_URLS.settings, { cache: 'no-cache' });
    if (!response.ok) return;

    const settings = new Map(
      parseCSV(await response.text())
        .filter(row => row.key && typeof row.value === 'string')
        .map(row => [row.key, row.value])
    );
    if (!settings.size) return;

    // Match the cutoff used by checkout until Apps Script reads the sheet too.
    const sheetCutoff = Number((settings.get('free_delivery_above_ghs') || '').replace(/,/g, ''));
    const deliveryText = sheetCutoff === FREE_DELIVERY_TARGET
      ? settings.get('ticker_text_2')
      : '';
    const promoOn = settings.get('promo_banner_on')?.toLowerCase() === 'yes';
    const promoText = promoOn
      ? settings.get('ticker_text_3') || settings.get('promo_banner_text')
      : '';

    const messages = [
      settings.get('ticker_text_1') || fallback[0],
      deliveryText || fallback[1],
      promoText
    ].filter(Boolean);

    if (!messages.length) return;

    for (const group of groups) {
      const spans = messages.map(message => {
        const span = document.createElement('span');
        span.textContent = message;
        return span;
      });
      group.replaceChildren(...spans);
    }
  } catch {
    // Leave the built-in banner in place if the published feed is unavailable.
  }
}

loadBannerSettings();
