/**
 * Lightweight validation for settings and payloads.
 */

import type { ExtensionSettings, PageCapturePayload } from '../types/extensionContracts';

export function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSettings(settings: ExtensionSettings): string[] {
  const errors: string[] = [];
  if (!settings.workerApiBaseUrl || !isValidHttpUrl(settings.workerApiBaseUrl)) {
    errors.push('Worker API Base URL must be a valid http(s) URL.');
  }
  if (settings.executiveEmail && !isValidEmail(settings.executiveEmail)) {
    errors.push('Executive Email must be a valid email address.');
  }
  if (!settings.mockMode && !settings.extensionLicenseKey.trim()) {
    errors.push('Extension License Key is required when Mock Mode is off.');
  }
  return errors;
}

export function validatePageCapture(payload: PageCapturePayload): string[] {
  const errors: string[] = [];
  if (payload.source !== 'plugthis_extension') {
    errors.push('Invalid capture source.');
  }
  if (!payload.page?.url) errors.push('Page URL is required.');
  if (!payload.captured_at) errors.push('captured_at is required.');
  return errors;
}
