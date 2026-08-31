/**
 * Worker API client — extension talks ONLY to the Cloudflare Worker.
 * Mock mode returns local fixtures when Worker is unavailable or mockMode=true.
 */

import type {
  AutomationLogRequest,
  AutomationLogResponse,
  ContentDraftRequest,
  ContentDraftResponse,
  ExtensionSettings,
  ExtensionValidationRequest,
  ExtensionValidationResponse,
  LeadCaptureRequest,
  LeadCaptureResponse,
  ResearchRunRequest,
  ResearchRunResponse,
  WebInsightRequest,
  WebInsightResponse,
} from '../types/extensionContracts';
import sampleLead from '../mock/sampleLeadCaptureResponse.json';

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'WorkerApiError';
  }
}

type HttpMethod = 'GET' | 'POST';

async function requestJson<T>(
  settings: ExtensionSettings,
  path: string,
  options: { method?: HttpMethod; body?: unknown } = {},
): Promise<{ data: T; mock: boolean }> {
  if (settings.mockMode) {
    return { data: mockForPath<T>(path, options.body), mock: true };
  }

  const url = `${settings.workerApiBaseUrl.replace(/\/+$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (settings.extensionLicenseKey) {
    headers['x-extension-license'] = settings.extensionLicenseKey;
  }
  if (settings.executiveEmail) {
    headers['x-executive-email'] = settings.executiveEmail;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'POST',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (settings.debugMode) {
      console.warn('[PlugThis] Worker unreachable, falling back to mock', error);
    }
    return { data: mockForPath<T>(path, options.body), mock: true };
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ||
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ||
      `Worker request failed (${res.status})`;

    if (res.status === 401 || res.status === 403) {
      throw new WorkerApiError(message || 'Invalid extension license', res.status, parsed);
    }
    throw new WorkerApiError(message, res.status, parsed);
  }

  return { data: parsed as T, mock: false };
}

function mockForPath<T>(path: string, body?: unknown): T {
  const now = Date.now();
  if (path === '/api/extension/validate') {
    return {
      valid: true,
      mock: true,
      message: 'Mock validation OK — Worker not contacted.',
      assigned_base_id: null,
    } as T;
  }
  if (path === '/api/leads/capture') {
    return {
      ...sampleLead,
      mock: true,
      lead_id: `mock_lead_${now}`,
      message: 'Mock lead capture — no Teable write performed.',
    } as T;
  }
  if (path === '/api/research/run') {
    return {
      ok: true,
      mock: true,
      research_run_id: `mock_run_${now}`,
      summary:
        'Mock research brief: company appears B2B-focused; buying signals inconclusive until Worker+Retriever are connected.',
      priority_score: 'Medium',
      automation_log_id: `mock_log_${now}`,
      message: 'Mock research — no Teable write performed.',
    } as T;
  }
  if (path === '/api/content/linkedin-post') {
    const req = body as ContentDraftRequest | undefined;
    return {
      ok: true,
      mock: true,
      kind: 'linkedin_post',
      draft_id: `mock_li_${now}`,
      title: 'Mock LinkedIn draft',
      body: `Mock LinkedIn post based on ${req?.capture.page.title || 'this page'}.\n\nReplace with Worker → Katteb output once the clone-safe template base and Worker are live.`,
      automation_log_id: `mock_log_${now}`,
      message: 'Mock LinkedIn draft — no Teable write performed.',
    } as T;
  }
  if (path === '/api/content/email-hook') {
    return {
      ok: true,
      mock: true,
      kind: 'email_hook',
      draft_id: `mock_em_${now}`,
      body: 'Noticed a specific detail on your site that often correlates with pipeline friction. Curious if that bottleneck is already on your radar — or if a sharper web/ops setup would help?',
      automation_log_id: `mock_log_${now}`,
      message: 'Mock email hook — no Teable write performed.',
    } as T;
  }
  if (path === '/api/web/insight') {
    return {
      ok: true,
      mock: true,
      insight_id: `mock_web_${now}`,
      summary:
        'Mock web insight: monitoring/security posture not evaluated live. Worker will later map to Web_Properties + Automation_Log.',
      automation_log_id: `mock_log_${now}`,
      message: 'Mock web insight — no Teable write performed.',
    } as T;
  }
  if (path === '/api/logs/automation') {
    return {
      ok: true,
      mock: true,
      log_id: `mock_log_${now}`,
      message: 'Mock automation log — no Teable write performed.',
    } as T;
  }
  return { ok: false, mock: true, error: `No mock for ${path}` } as T;
}

export async function validateLicense(
  settings: ExtensionSettings,
): Promise<ExtensionValidationResponse> {
  const body: ExtensionValidationRequest = {
    license_key: settings.extensionLicenseKey,
    executive_email: settings.executiveEmail || null,
    tenant_id: settings.tenantId || null,
    extension_version: chrome.runtime.getManifest().version,
  };
  const { data, mock } = await requestJson<ExtensionValidationResponse>(
    settings,
    '/api/extension/validate',
    { body },
  );
  return { ...data, mock: data.mock ?? mock };
}

export async function captureLead(
  settings: ExtensionSettings,
  body: LeadCaptureRequest,
): Promise<LeadCaptureResponse> {
  const { data, mock } = await requestJson<LeadCaptureResponse>(
    settings,
    '/api/leads/capture',
    { body },
  );
  return { ...data, mock: data.mock ?? mock };
}

export async function runResearch(
  settings: ExtensionSettings,
  body: ResearchRunRequest,
): Promise<ResearchRunResponse> {
  const { data, mock } = await requestJson<ResearchRunResponse>(
    settings,
    '/api/research/run',
    { body },
  );
  return { ...data, mock: data.mock ?? mock };
}

export async function draftLinkedInPost(
  settings: ExtensionSettings,
  body: Omit<ContentDraftRequest, 'kind'>,
): Promise<ContentDraftResponse> {
  const { data, mock } = await requestJson<ContentDraftResponse>(
    settings,
    '/api/content/linkedin-post',
    { body: { ...body, kind: 'linkedin_post' } },
  );
  return { ...data, mock: data.mock ?? mock };
}

export async function draftEmailHook(
  settings: ExtensionSettings,
  body: Omit<ContentDraftRequest, 'kind'>,
): Promise<ContentDraftResponse> {
  const { data, mock } = await requestJson<ContentDraftResponse>(
    settings,
    '/api/content/email-hook',
    { body: { ...body, kind: 'email_hook' } },
  );
  return { ...data, mock: data.mock ?? mock };
}

export async function logWebInsight(
  settings: ExtensionSettings,
  body: WebInsightRequest,
): Promise<WebInsightResponse> {
  const { data, mock } = await requestJson<WebInsightResponse>(settings, '/api/web/insight', {
    body,
  });
  return { ...data, mock: data.mock ?? mock };
}

export async function writeAutomationLog(
  settings: ExtensionSettings,
  body: AutomationLogRequest,
): Promise<AutomationLogResponse> {
  const { data, mock } = await requestJson<AutomationLogResponse>(
    settings,
    '/api/logs/automation',
    { body },
  );
  return { ...data, mock: data.mock ?? mock };
}
