/**
 * Sanitize page extraction — strip secrets, passwords, payment fields, hidden inputs.
 */

const MAX_VISIBLE_TEXT = 8_000;
const MAX_SELECTED = 2_000;
const MAX_META = 1_000;

const SENSITIVE_INPUT_TYPES = new Set([
  'password',
  'email',
  'tel',
  'number',
  'credit-card',
  'cc-number',
  'cc-csc',
  'cc-exp',
]);

const SENSITIVE_NAME_RE =
  /(password|passwd|secret|ssn|social.?security|credit.?card|card.?number|cvv|cvc|iban|routing|account.?number|otp|pin)/i;

export function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export function sanitizePlainText(input: string | null | undefined, max = MAX_META): string | null {
  if (!input) return null;
  const withoutControls = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const truncated = truncate(withoutControls, max);
  return truncated || null;
}

export function isSensitiveElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (SENSITIVE_INPUT_TYPES.has(type)) return true;
    if (SENSITIVE_NAME_RE.test(el.name || '') || SENSITIVE_NAME_RE.test(el.id || '')) return true;
    if (el.autocomplete && /cc-|current-password|new-password/i.test(el.autocomplete)) return true;
  }
  if (el instanceof HTMLTextAreaElement) {
    if (SENSITIVE_NAME_RE.test(el.name || '') || SENSITIVE_NAME_RE.test(el.id || '')) return true;
  }
  if (el.getAttribute('type') === 'hidden' || el.hasAttribute('hidden')) return true;
  const aria = el.getAttribute('aria-hidden');
  if (aria === 'true') return true;
  return false;
}

/**
 * Collect visible text while skipping scripts/styles/sensitive controls.
 */
export function extractVisibleText(root: ParentNode = document.body, max = MAX_VISIBLE_TEXT): string {
  if (!root) return '';
  const parts: string[] = [];
  let total = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'svg', 'iframe'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isSensitiveElement(parent)) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return NodeFilter.FILTER_REJECT;
      }
      const text = node.textContent?.trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current && total < max) {
    const chunk = truncate(current.textContent || '', Math.min(400, max - total));
    if (chunk) {
      parts.push(chunk);
      total += chunk.length + 1;
    }
    current = walker.nextNode();
  }

  return truncate(parts.join(' '), max);
}

export function detectLinkedInUrl(doc: Document = document): string | null {
  const anchors = Array.from(doc.querySelectorAll('a[href*="linkedin.com"]'));
  for (const a of anchors) {
    const href = (a as HTMLAnchorElement).href;
    if (/linkedin\.com\/(in|company)\//i.test(href)) {
      return href.split('?')[0] ?? href;
    }
  }
  if (/linkedin\.com\/(in|company)\//i.test(doc.location.href)) {
    return doc.location.href.split('?')[0] ?? doc.location.href;
  }
  return null;
}

export { MAX_VISIBLE_TEXT, MAX_SELECTED, MAX_META };
