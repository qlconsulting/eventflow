/**
 * Content script — responds to page capture requests only.
 * Never calls Teable / vendor APIs.
 */

import { capturePage } from './pageExtract';
import type { ExtensionRuntimeMessage } from '../types/extensionContracts';

chrome.runtime.onMessage.addListener((message: ExtensionRuntimeMessage, _sender, sendResponse) => {
  if (message?.type !== 'GET_PAGE_CAPTURE') {
    return false;
  }

  try {
    // Executive context is filled by the service worker / popup from settings
    const payload = capturePage(null, null);
    sendResponse({ type: 'PAGE_CAPTURE_RESULT', ok: true, capture: payload });
  } catch (error) {
    sendResponse({
      type: 'PAGE_CAPTURE_RESULT',
      ok: false,
      error: error instanceof Error ? error.message : 'Page capture failed',
    });
  }
  return true;
});
