/**
 * Service worker — proxies authenticated requests to the Cloudflare Worker.
 * Master API keys never live here; only the User JWT is forwarded.
 */

const DEFAULT_API_BASE = 'https://api.theleveragelab.com';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (!result.apiBaseUrl) {
      chrome.storage.local.set({ apiBaseUrl: DEFAULT_API_BASE });
    }
  });
});

async function proxyJson(apiBaseUrl, path, { method = 'GET', userJwt, body } = {}) {
  const url = `${apiBaseUrl.replace(/\/+$/, '')}${path}`;
  const headers = {
    Accept: 'application/json',
  };
  if (userJwt) {
    headers.Authorization = `Bearer ${userJwt}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      `Request failed (${res.status})`;
    return { ok: false, status: res.status, error: String(message), data };
  }

  return { ok: true, status: res.status, data };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || typeof message !== 'object') {
      sendResponse({ ok: false, error: 'Invalid message' });
      return;
    }

    const apiBaseUrl = message.apiBaseUrl || DEFAULT_API_BASE;

    if (message.type === 'FETCH_PROMPTS') {
      // Worker may expose a prompts endpoint later; until then orchestrate clients
      // can supply templates via storage. Prefer Worker when available.
      const result = await proxyJson(apiBaseUrl, '/api/prompts', {
        method: 'GET',
        userJwt: message.userJwt,
      });

      if (!result.ok) {
        // Graceful empty state if endpoint is not yet deployed
        if (result.status === 404) {
          sendResponse({ ok: true, templates: [] });
          return;
        }
        sendResponse({ ok: false, error: result.error });
        return;
      }

      const templates = Array.isArray(result.data?.templates)
        ? result.data.templates
        : Array.isArray(result.data)
          ? result.data
          : [];
      sendResponse({ ok: true, templates });
      return;
    }

    if (message.type === 'ORCHESTRATE') {
      const result = await proxyJson(apiBaseUrl, '/api/orchestrate', {
        method: 'POST',
        userJwt: message.userJwt,
        body: message.payload,
      });

      if (!result.ok) {
        sendResponse({ ok: false, error: result.error, data: result.data });
        return;
      }
      sendResponse({ ok: true, data: result.data });
      return;
    }

    sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
  })().catch((err) => {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : 'Background error',
    });
  });

  return true; // keep channel open for async sendResponse
});
