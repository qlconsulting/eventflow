/**
 * Popup controller — UI only; actions go through the service worker.
 */

import { getSettings } from '../lib/storage';

const els = {
  title: document.getElementById('page-title') as HTMLElement,
  url: document.getElementById('page-url') as HTMLElement,
  status: document.getElementById('status') as HTMLElement,
  modeBadge: document.getElementById('mode-badge') as HTMLElement,
  openOptions: document.getElementById('open-options') as HTMLButtonElement,
};

function setStatus(message: string, kind: '' | 'is-error' | 'is-success' = '') {
  els.status.textContent = message;
  els.status.classList.remove('is-error', 'is-success');
  if (kind) els.status.classList.add(kind);
}

function setBusy(busy: boolean) {
  document.querySelectorAll<HTMLButtonElement>('.btn[data-action]').forEach((btn) => {
    btn.disabled = busy;
    btn.classList.toggle('btn--busy', busy && btn.dataset.pending === '1');
  });
}

async function loadPageMeta() {
  const settings = await getSettings();
  els.modeBadge.textContent = settings.mockMode ? 'Mock mode' : 'Live Worker';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  els.title.textContent = tab?.title || 'Untitled page';
  els.url.textContent = tab?.url || '';
}

async function runAction(action: string, button: HTMLButtonElement) {
  setBusy(true);
  button.dataset.pending = '1';
  setStatus(`Running ${action.replace(/_/g, ' ')}…`);

  try {
    const response = await chrome.runtime.sendMessage({ type: 'RUN_ACTION', action });
    if (!response?.ok) {
      setStatus(response?.error || 'Action failed', 'is-error');
      return;
    }
    const result = response.result ?? {};
    const mockTag = result.mock ? ' [mock]' : '';
    const detail =
      result.body ||
      result.summary ||
      result.message ||
      result.lead_id ||
      'Done';
    setStatus(`${String(detail).slice(0, 280)}${mockTag}`, 'is-success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Action failed', 'is-error');
  } finally {
    button.dataset.pending = '0';
    setBusy(false);
  }
}

document.querySelectorAll<HTMLButtonElement>('.btn[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action) void runAction(action, btn);
  });
});

els.openOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

loadPageMeta().catch((err) => {
  setStatus(err instanceof Error ? err.message : 'Failed to load tab', 'is-error');
});
