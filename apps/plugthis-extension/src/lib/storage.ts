/**
 * Local settings via chrome.storage.local.
 * Never store Teable tokens, vendor API keys, or Worker JWT secrets here.
 */

import {
  DEFAULT_WORKER_API_BASE,
  type ExtensionSettings,
} from '../types/extensionContracts';

const STORAGE_KEY = 'plugthis_settings_v1';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  workerApiBaseUrl: DEFAULT_WORKER_API_BASE,
  extensionLicenseKey: '',
  executiveEmail: '',
  tenantId: '',
  debugMode: true,
  mockMode: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const raw = stored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
    workerApiBaseUrl: (raw?.workerApiBaseUrl || DEFAULT_WORKER_API_BASE).replace(/\/+$/, ''),
  };
}

export async function saveSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = {
    ...current,
    ...patch,
    workerApiBaseUrl: (patch.workerApiBaseUrl ?? current.workerApiBaseUrl).replace(
      /\/+$/,
      '',
    ),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export function assertNoSecretsInSettings(settings: ExtensionSettings): string[] {
  const warnings: string[] = [];
  const blob = JSON.stringify(settings).toLowerCase();
  const forbidden = ['teable_', 'sk-', 'Bearer ', 'api_key=', 'katteb', 'qolaba', 'retriever'];
  for (const token of forbidden) {
    if (blob.includes(token.toLowerCase())) {
      warnings.push(`Possible secret-like value detected near "${token.trim()}" — remove it.`);
    }
  }
  return warnings;
}
