/**
 * Content script — lightweight page helpers for target context.
 * Does not access or store API keys.
 */

(() => {
  const META_KEY = '__leverageLabPageMeta';

  function collectPageMeta() {
    const title = document.title || '';
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const canonical =
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') || location.href;

    return {
      title,
      description,
      canonical,
      href: location.href,
      collectedAt: new Date().toISOString(),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_PAGE_META') {
      const meta = collectPageMeta();
      window[META_KEY] = meta;
      sendResponse({ ok: true, meta });
      return true;
    }
    return false;
  });
})();
