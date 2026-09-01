/**
 * Options page — local chrome.storage settings only (no secrets / vendor keys).
 */

import { assertNoSecretsInSettings, getSettings, saveSettings } from '../lib/storage';
import { validateSettings } from '../lib/validation';
import type { ExtensionSettings } from '../types/extensionContracts';

const form = document.getElementById('settings-form') as HTMLFormElement;
const statusEl = document.getElementById('status') as HTMLElement;
const validateBtn = document.getElementById('validate') as HTMLButtonElement;

const fields = {
  workerApiBaseUrl: document.getElementById('workerApiBaseUrl') as HTMLInputElement,
  extensionLicenseKey: document.getElementById('extensionLicenseKey') as HTMLInputElement,
  executiveEmail: document.getElementById('executiveEmail') as HTMLInputElement,
  tenantId: document.getElementById('tenantId') as HTMLInputElement,
  debugMode: document.getElementById('debugMode') as HTMLInputElement,
  mockMode: document.getElementById('mockMode') as HTMLInputElement,
};

function setStatus(message: string, kind: '' | 'is-error' | 'is-success' = '') {
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-success');
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.remove('is-error', 'is-success');
  if (kind) statusEl.classList.add(kind);
}

function readForm(): ExtensionSettings {
  return {
    workerApiBaseUrl: fields.workerApiBaseUrl.value.trim(),
    extensionLicenseKey: fields.extensionLicenseKey.value.trim(),
    executiveEmail: fields.executiveEmail.value.trim(),
    tenantId: fields.tenantId.value.trim(),
    debugMode: fields.debugMode.checked,
    mockMode: fields.mockMode.checked,
  };
}

function fillForm(settings: ExtensionSettings) {
  fields.workerApiBaseUrl.value = settings.workerApiBaseUrl;
  fields.extensionLicenseKey.value = settings.extensionLicenseKey;
  fields.executiveEmail.value = settings.executiveEmail;
  fields.tenantId.value = settings.tenantId;
  fields.debugMode.checked = settings.debugMode;
  fields.mockMode.checked = settings.mockMode;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const next = readForm();
  const errors = validateSettings(next);
  const secretWarnings = assertNoSecretsInSettings(next);
  if (errors.length) {
    setStatus(errors.join(' '), 'is-error');
    return;
  }
  await saveSettings(next);
  const warn = secretWarnings.length ? ` Warning: ${secretWarnings.join(' ')}` : '';
  setStatus(`Settings saved.${warn}`, secretWarnings.length ? 'is-error' : 'is-success');
});

validateBtn.addEventListener('click', async () => {
  const next = readForm();
  await saveSettings(next);
  setStatus('Validating license via Worker (or mock)…');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'VALIDATE_LICENSE' });
    if (!response?.ok) {
      setStatus(response?.error || 'Validation failed', 'is-error');
      return;
    }
    const result = response.result;
    if (!result?.valid) {
      setStatus(result?.message || result?.error || 'License invalid', 'is-error');
      return;
    }
    setStatus(
      `${result.message || 'License valid'}${result.mock ? ' [mock]' : ''}`,
      'is-success',
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Validation failed', 'is-error');
  }
});

getSettings()
  .then(fillForm)
  .catch((err) => {
    setStatus(err instanceof Error ? err.message : 'Failed to load settings', 'is-error');
  });
