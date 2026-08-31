/**
 * Safe page extraction for PlugThis content script.
 */

import {
  EXTENSION_SOURCE,
  type PageCapturePayload,
} from '../types/extensionContracts';
import {
  detectLinkedInUrl,
  extractVisibleText,
  MAX_SELECTED,
  sanitizePlainText,
} from '../lib/sanitize';

export function capturePage(
  executiveEmail: string | null,
  tenantId: string | null,
): PageCapturePayload {
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
  const h1 = document.querySelector('h1')?.textContent || null;
  const selected = window.getSelection()?.toString() || null;

  return {
    source: EXTENSION_SOURCE,
    captured_at: new Date().toISOString(),
    page: {
      title: document.title || '',
      url: location.href,
      canonical_url: sanitizePlainText(canonical, 2000),
      meta_description: sanitizePlainText(metaDescription, 1000),
      h1: sanitizePlainText(h1, 500),
      selected_text: sanitizePlainText(selected, MAX_SELECTED),
      visible_text_excerpt: extractVisibleText(document.body),
      linkedin_url: detectLinkedInUrl(document),
    },
    executive_context: {
      executive_email: executiveEmail,
      tenant_id: tenantId,
    },
  };
}
