/**
 * Service worker — proxies popup actions to Worker API client (or mock).
 * Never talks to Teable, Dashform, or AI vendors directly.
 */

import {
  captureLead,
  draftEmailHook,
  draftLinkedInPost,
  logWebInsight,
  runResearch,
  validateLicense,
  WorkerApiError,
} from '../lib/apiClient';
import { getSettings } from '../lib/storage';
import { validatePageCapture } from '../lib/validation';
import type {
  ExtensionRuntimeMessage,
  PageCapturePayload,
} from '../types/extensionContracts';

chrome.runtime.onInstalled.addListener(() => {
  // Defaults are applied lazily via getSettings()
});

async function getActiveTabCapture(): Promise<PageCapturePayload> {
  const settings = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab');
  }

  let response: ExtensionRuntimeMessage | undefined;
  try {
    response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_CAPTURE',
    })) as ExtensionRuntimeMessage;
  } catch {
    // Content script may be missing (chrome:// pages, etc.) — inject once
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/contentScript.js'],
    });
    response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_CAPTURE',
    })) as ExtensionRuntimeMessage;
  }

  if (!response || response.type !== 'PAGE_CAPTURE_RESULT' || !response.ok) {
    const err =
      response && response.type === 'PAGE_CAPTURE_RESULT' && !response.ok
        ? response.error
        : 'Unable to capture page';
    throw new Error(err);
  }

  const capture: PageCapturePayload = {
    ...response.capture,
    executive_context: {
      executive_email: settings.executiveEmail || null,
      tenant_id: settings.tenantId || null,
    },
  };

  const errors = validatePageCapture(capture);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }
  return capture;
}

chrome.runtime.onMessage.addListener((message: ExtensionRuntimeMessage, _sender, sendResponse) => {
  (async () => {
    const settings = await getSettings();

    if (message?.type === 'VALIDATE_LICENSE') {
      try {
        const result = await validateLicense(settings);
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof WorkerApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Validation failed',
        });
      }
      return;
    }

    if (message?.type !== 'RUN_ACTION') {
      sendResponse({ ok: false, error: 'Unknown message' });
      return;
    }

    try {
      if (!settings.mockMode) {
        const validation = await validateLicense(settings);
        if (!validation.valid) {
          sendResponse({
            ok: false,
            error: validation.message || validation.error || 'Invalid extension license',
          });
          return;
        }
      }

      const capture = await getActiveTabCapture();

      switch (message.action) {
        case 'capture_lead': {
          const result = await captureLead(settings, { capture });
          sendResponse({ ok: true, result });
          return;
        }
        case 'run_research': {
          const result = await runResearch(settings, {
            capture,
            prompt_template_hint: 'Company Research Brief',
          });
          sendResponse({ ok: true, result });
          return;
        }
        case 'draft_linkedin': {
          const result = await draftLinkedInPost(settings, { capture });
          sendResponse({ ok: true, result });
          return;
        }
        case 'draft_email': {
          const result = await draftEmailHook(settings, { capture });
          sendResponse({ ok: true, result });
          return;
        }
        case 'log_web_insight': {
          const result = await logWebInsight(settings, { capture });
          sendResponse({ ok: true, result });
          return;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown action' });
      }
    } catch (error) {
      const msg =
        error instanceof WorkerApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Action failed';
      sendResponse({ ok: false, error: msg });
    }
  })();

  return true;
});
