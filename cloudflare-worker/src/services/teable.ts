/**
 * Teable API integrations — Executive_Directory, template clone, Prompt_Library,
 * Provisioning_Log, and Master_Prompt_Templates / Tone_Persona_Matrix reads.
 */

import type {
  ClientRegistryRecord,
  Env,
  JwtClaims,
  OnboardingIntake,
  ProvisioningStep,
  WorkspaceStatus,
} from '../types';
import { verifyDashformSecret } from '../utils/auth';
import { parseDashformPayload } from '../utils/dashform';
import { compileBrandTonePrompt, jsonError, jsonOk } from '../utils/helpers';

const TEABLE_API_BASE = 'https://app.teable.io/api';

interface TeableRequestOptions {
  method?: string;
  body?: unknown;
}

interface TeableRecord {
  id?: string;
  fields?: Record<string, unknown>;
}

async function teableFetch(
  env: Env,
  path: string,
  options: TeableRequestOptions = {},
): Promise<Response> {
  return fetch(`${TEABLE_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${env.TEABLE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function fieldString(fields: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!fields) return '';
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function statusFromError(error: unknown): number {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status: number }).status);
  }
  return 500;
}

async function createRecords(
  env: Env,
  tableId: string,
  records: Array<{ fields: Record<string, unknown> }>,
): Promise<TeableRecord[]> {
  const res = await teableFetch(env, `/table/${tableId}/record`, {
    method: 'POST',
    body: { records },
  });
  if (res.status === 429) {
    throw Object.assign(new Error('Teable rate limited'), { status: 429 });
  }
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Teable create failed: ${text}`), { status: res.status });
  }
  const data = (await res.json()) as { records?: TeableRecord[] };
  return data.records ?? [];
}

/**
 * Look up an executive in Executive_Directory by Executive Email.
 */
export async function lookupAssignedBaseId(
  email: string,
  env: Env,
): Promise<ClientRegistryRecord | null> {
  const tableId = env.TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID;
  const filter = encodeURIComponent(`{Executive Email}="${email.replace(/"/g, '\\"')}"`);
  const path = `/table/${tableId}/record?filter=${filter}&take=1`;

  try {
    const res = await teableFetch(env, path);
    if (res.status === 429) {
      throw Object.assign(new Error('Teable rate limited'), { status: 429 });
    }
    if (!res.ok) {
      throw Object.assign(new Error(`Teable lookup failed (${res.status})`), {
        status: res.status,
      });
    }
    const data = (await res.json()) as { records?: TeableRecord[] };
    const record = data.records?.[0];
    const fields = record?.fields;
    if (!fields) return null;

    const assignedBaseId = fieldString(
      fields,
      'Assigned Base ID',
      'Assigned Workspace Base ID',
      'Workspace Base ID',
      'assignedBaseId',
    );
    if (!assignedBaseId) return null;

    return {
      email,
      assignedBaseId,
      recordId: record?.id,
      companyName: fieldString(fields, 'Company Name') || undefined,
      fullName: fieldString(fields, 'Executive Name', 'Full Name') || undefined,
      workspaceStatus: (fieldString(fields, 'Workspace Status') || undefined) as
        | WorkspaceStatus
        | undefined,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Teable registry lookup error'), { cause: error });
  }
}

export async function writeProvisioningLog(
  env: Env,
  params: {
    eventId: string;
    executiveRecordId?: string;
    source: 'Dashform' | 'Manual' | 'Stripe' | 'Worker' | 'Extension';
    step: ProvisioningStep;
    status: 'Pending' | 'Success' | 'Failed';
    payloadSnapshot?: unknown;
    errorMessage?: string;
  },
): Promise<void> {
  if (!env.TEABLE_PROVISIONING_LOG_TABLE_ID || env.TEABLE_PROVISIONING_LOG_TABLE_ID === 'PENDING_TEABLE') {
    return;
  }

  const fields: Record<string, unknown> = {
    'Event ID': params.eventId,
    Source: params.source,
    Step: params.step,
    Status: params.status,
    Timestamp: new Date().toISOString(),
  };
  if (params.executiveRecordId) {
    fields.Executive = [{ id: params.executiveRecordId }];
  }
  if (params.payloadSnapshot !== undefined) {
    fields['Payload Snapshot'] = JSON.stringify(params.payloadSnapshot);
  }
  if (params.errorMessage) {
    fields['Error Message'] = params.errorMessage;
  }

  await createRecords(env, env.TEABLE_PROVISIONING_LOG_TABLE_ID, [{ fields }]);
}

/**
 * Duplicate [TEMPLATE] The Leverage Lab - Executive Workspace for a new client.
 */
export async function cloneTemplateWorkspace(
  companyName: string,
  executiveName: string,
  env: Env,
): Promise<{ baseId: string }> {
  const templateBaseId = env.TEABLE_TEMPLATE_BASE_ID;
  if (!templateBaseId || templateBaseId === 'PENDING_TEABLE') {
    throw Object.assign(new Error('TEABLE_TEMPLATE_BASE_ID is not configured'), { status: 500 });
  }

  try {
    const res = await teableFetch(env, `/base/${templateBaseId}/duplicate`, {
      method: 'POST',
      body: {
        name: `The Leverage Lab — ${executiveName} (${companyName})`,
      },
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Teable rate limited while cloning'), { status: 429 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Template clone failed: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as { id?: string; baseId?: string };
    const baseId = data.id ?? data.baseId;
    if (!baseId) {
      throw new Error('Clone response missing base id');
    }
    return { baseId };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Failed to clone template workspace'), { cause: error });
  }
}

export async function createClientProfile(
  baseId: string,
  intake: OnboardingIntake,
  env: Env,
): Promise<string | undefined> {
  // Address tables via cloned base + table name. Template table IDs in env
  // refer to the source template, not the per-client duplicate.
  const path = `/base/${baseId}/table/Client_Profile/record`;

  const fields: Record<string, unknown> = {
    'Profile Name': `${intake.executiveName} — ${intake.companyName}`,
    'Executive Name': intake.executiveName,
    'Executive Email': intake.executiveEmail,
    'Company Name': intake.companyName,
    'Brand Tone': intake.brandTone,
    'Web Management Client': intake.webManagementClient,
    'Created Date': new Date().toISOString(),
  };
  if (intake.companyWebsite) fields['Company Website'] = intake.companyWebsite;
  if (intake.executiveLinkedIn) fields['Executive LinkedIn'] = intake.executiveLinkedIn;
  if (intake.targetAudience) fields['Target Audience'] = intake.targetAudience;
  if (intake.coreOffer) fields['Core Offer'] = intake.coreOffer;
  if (intake.primaryPainPoint) fields['Primary Pain Point'] = intake.primaryPainPoint;
  if (intake.preferredChannels) fields['Preferred Channels'] = intake.preferredChannels;
  if (intake.managedDomain) fields['Managed Domain'] = intake.managedDomain;
  if (intake.webManagementScope) fields['Web Management Scope'] = intake.webManagementScope;
  if (intake.brandVoiceNotes) fields['Brand Voice Notes'] = intake.brandVoiceNotes;
  fields['Intake Summary'] = JSON.stringify(intake);

  const res = await teableFetch(env, path, { method: 'POST', body: { records: [{ fields }] } });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Client_Profile create failed: ${text}`), { status: res.status });
  }
  const data = (await res.json()) as { records?: TeableRecord[] };
  return data.records?.[0]?.id;
}

/**
 * Fetch tone rules from Tone_Persona_Matrix for the selected brand tone.
 */
export async function fetchTonePersona(
  brandTone: string,
  env: Env,
): Promise<{ voiceRules: string; openingHookStyle?: string; writingRules?: string; avoidList?: string } | null> {
  const tableId = env.TEABLE_TONE_PERSONA_MATRIX_TABLE_ID;
  if (!tableId || tableId === 'PENDING_TEABLE') return null;

  const filter = encodeURIComponent(`{Tone Name}="${brandTone.replace(/"/g, '\\"')}"`);
  const res = await teableFetch(env, `/table/${tableId}/record?filter=${filter}&take=1`);
  if (!res.ok) return null;

  const data = (await res.json()) as { records?: TeableRecord[] };
  const fields = data.records?.[0]?.fields;
  if (!fields) return null;

  return {
    voiceRules: fieldString(fields, 'Voice Rules'),
    openingHookStyle: fieldString(fields, 'Opening Hook Style') || undefined,
    writingRules: fieldString(fields, 'Writing Rules') || undefined,
    avoidList: fieldString(fields, 'Avoid List') || undefined,
  };
}

/**
 * Seed client Prompt_Library from Master_Prompt_Templates (Active=true),
 * compiling tone into System Instructions where useful.
 */
export async function seedPromptLibraryFromMaster(
  baseId: string,
  intake: OnboardingIntake,
  env: Env,
): Promise<number> {
  const masterTableId = env.TEABLE_MASTER_PROMPT_TEMPLATES_TABLE_ID;
  if (!masterTableId || masterTableId === 'PENDING_TEABLE') {
    // Fallback: inject a single tone-compiled system prompt row
    const systemPrompt = compileBrandTonePrompt(intake.brandTone, intake.brandVoiceNotes);
    await injectFallbackPrompt(baseId, env, systemPrompt);
    return 1;
  }

  const filter = encodeURIComponent('{Active}=true');
  const res = await teableFetch(env, `/table/${masterTableId}/record?filter=${filter}&take=100`);
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Master_Prompt_Templates read failed: ${text}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { records?: TeableRecord[] };
  const tone = await fetchTonePersona(intake.brandTone, env);
  const toneBlock = tone
    ? [
        tone.voiceRules,
        tone.openingHookStyle ? `Opening hook style: ${tone.openingHookStyle}` : '',
        tone.writingRules ? `Writing rules: ${tone.writingRules}` : '',
        tone.avoidList ? `Avoid: ${tone.avoidList}` : '',
        intake.brandVoiceNotes ? `Brand voice notes: ${intake.brandVoiceNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : compileBrandTonePrompt(intake.brandTone, intake.brandVoiceNotes);

  const records = (data.records ?? []).map((record) => {
    const f = record.fields ?? {};
    const systemInstructions = [
      fieldString(f, 'System Instruction Template'),
      `\n--- Brand Tone (${intake.brandTone}) ---\n${toneBlock}`,
    ].join('\n');

    return {
      fields: {
        'Prompt Name': fieldString(f, 'Template Name') || 'Untitled Template',
        Category: fieldString(f, 'Category') || 'Research Synthesis',
        'System Instructions': systemInstructions,
        'Refined Prompt Template': fieldString(f, 'Prompt Body Template'),
        'Required Variables': fieldString(f, 'Required Variables'),
        Status: 'Active',
        'Template Version': fieldString(f, 'Template Version') || 'v1.0',
        'Last Updated': new Date().toISOString(),
      },
    };
  });

  if (records.length === 0) {
    await injectFallbackPrompt(
      baseId,
      env,
      compileBrandTonePrompt(intake.brandTone, intake.brandVoiceNotes),
    );
    return 1;
  }

  const promptPath = `/base/${baseId}/table/Prompt_Library/record`;

  const write = await teableFetch(env, promptPath, { method: 'POST', body: { records } });
  if (!write.ok) {
    const text = await write.text();
    throw Object.assign(new Error(`Prompt_Library seed failed: ${text}`), { status: write.status });
  }
  return records.length;
}

async function injectFallbackPrompt(baseId: string, env: Env, systemPrompt: string): Promise<void> {
  const path = `/base/${baseId}/table/Prompt_Library/record`;

  const res = await teableFetch(env, path, {
    method: 'POST',
    body: {
      records: [
        {
          fields: {
            'Prompt Name': 'Brand System Prompt',
            Category: 'Research Synthesis',
            'System Instructions': systemPrompt,
            'Refined Prompt Template': '{{company_context}}',
            'Required Variables': '{{company_context}}',
            Status: 'Active',
            'Template Version': 'v1.0',
            'Last Updated': new Date().toISOString(),
          },
        },
      ],
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Fallback Prompt_Library inject failed: ${text}`), {
      status: res.status,
    });
  }
}

/**
 * Upsert / register executive in Executive_Directory after provisioning.
 */
export async function registerClientInMaster(
  intake: OnboardingIntake,
  assignedBaseId: string,
  env: Env,
  options: { workspaceStatus?: WorkspaceStatus; errorMessage?: string } = {},
): Promise<string | undefined> {
  const dashboardUrl = `${env.LAB_DASHBOARD_URL.replace(/\/+$/, '')}/w/${assignedBaseId}`;
  const fields: Record<string, unknown> = {
    'Executive Email': intake.executiveEmail,
    'Executive Name': intake.executiveName,
    'Company Name': intake.companyName,
    'Assigned Base ID': assignedBaseId,
    'Client Package': intake.clientPackage,
    'Workspace Status': options.workspaceStatus ?? 'Active',
    'Dashform Submission ID': intake.submissionId,
    'Dashboard URL': dashboardUrl,
  };
  if (intake.companyWebsite) fields['Company Website'] = intake.companyWebsite;
  if (intake.executiveLinkedIn) fields['Executive LinkedIn'] = intake.executiveLinkedIn;
  if (options.errorMessage) fields['Last Provisioning Error'] = options.errorMessage;

  const created = await createRecords(env, env.TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID, [{ fields }]);
  return created[0]?.id;
}

/**
 * Dashform `/api/onboarding` handler — provisioning pipeline (not live until IDs + webhook exist).
 */
export async function handleOnboarding(rawBody: unknown, env: Env): Promise<Response> {
  const parsed = parseDashformPayload(rawBody);
  if (!parsed.ok) {
    return jsonError(400, 'VALIDATION_ERROR', parsed.message);
  }

  const { intake, envelope } = parsed;
  if (!verifyDashformSecret(envelope.webhookSecret, env)) {
    // Also accept secret from Authorization / X-Webhook-Secret in future; body field for now.
    return jsonError(401, 'UNAUTHORIZED', 'Invalid Dashform webhook secret');
  }

  const eventId = `prov_${intake.submissionId}_${Date.now()}`;

  try {
    const existing = await lookupAssignedBaseId(intake.executiveEmail, env);
    if (existing) {
      return jsonOk({
        status: 'already_registered',
        email: existing.email,
        assignedBaseId: existing.assignedBaseId,
        workspaceStatus: existing.workspaceStatus,
      });
    }

    await writeProvisioningLog(env, {
      eventId,
      source: 'Dashform',
      step: 'Intake Received',
      status: 'Success',
      payloadSnapshot: envelope,
    });

    const { baseId } = await cloneTemplateWorkspace(
      intake.companyName,
      intake.executiveName,
      env,
    );
    await writeProvisioningLog(env, {
      eventId,
      source: 'Worker',
      step: 'Template Base Cloned',
      status: 'Success',
      payloadSnapshot: { baseId },
    });

    await createClientProfile(baseId, intake, env);
    await writeProvisioningLog(env, {
      eventId,
      source: 'Worker',
      step: 'Client Profile Created',
      status: 'Success',
    });

    const seeded = await seedPromptLibraryFromMaster(baseId, intake, env);
    await writeProvisioningLog(env, {
      eventId,
      source: 'Worker',
      step: 'Prompt Library Seeded',
      status: 'Success',
      payloadSnapshot: { templatesSeeded: seeded },
    });

    const executiveRecordId = await registerClientInMaster(intake, baseId, env, {
      workspaceStatus: 'Active',
    });
    await writeProvisioningLog(env, {
      eventId,
      executiveRecordId,
      source: 'Worker',
      step: 'Executive Directory Updated',
      status: 'Success',
    });

    await writeProvisioningLog(env, {
      eventId,
      executiveRecordId,
      source: 'Worker',
      step: 'Complete',
      status: 'Success',
    });

    return jsonOk(
      {
        status: 'onboarded',
        email: intake.executiveEmail,
        assignedBaseId: baseId,
        dashboardUrl: `${env.LAB_DASHBOARD_URL.replace(/\/+$/, '')}/w/${baseId}`,
        templatesSeeded: seeded,
      },
      201,
    );
  } catch (error) {
    const status = statusFromError(error);
    const message = error instanceof Error ? error.message : 'Onboarding failed';

    try {
      await writeProvisioningLog(env, {
        eventId,
        source: 'Worker',
        step: 'Error',
        status: 'Failed',
        errorMessage: message,
        payloadSnapshot: intake,
      });
    } catch {
      // best-effort logging
    }

    if (status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    return jsonError(status >= 400 && status < 600 ? status : 500, 'ONBOARDING_ERROR', message);
  }
}

/**
 * Resolve the authenticated user's private Teable base.
 */
export async function resolveUserBase(
  claims: JwtClaims,
  env: Env,
): Promise<ClientRegistryRecord | Response> {
  try {
    const record = await lookupAssignedBaseId(claims.email, env);
    if (!record) {
      return jsonError(404, 'NOT_FOUND', `No assigned base for ${claims.email}`);
    }
    return record;
  } catch (error) {
    const status = statusFromError(error);
    if (status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    return jsonError(500, 'TEABLE_ERROR', 'Failed to resolve user base');
  }
}

export interface PromptTemplateSummary {
  id: string;
  name: string;
  category?: string;
  status?: string;
}

/**
 * List Active prompt templates from the executive's private Prompt_Library.
 */
export async function listPromptTemplates(
  claims: JwtClaims,
  env: Env,
): Promise<Response> {
  const baseOrError = await resolveUserBase(claims, env);
  if (baseOrError instanceof Response) return baseOrError;

  try {
    const path = `/base/${baseOrError.assignedBaseId}/table/Prompt_Library/record?take=100`;

    const res = await teableFetch(env, path);
    if (res.status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    if (!res.ok) {
      return jsonError(res.status, 'TEABLE_ERROR', `Failed to list prompts (${res.status})`);
    }

    const data = (await res.json()) as { records?: TeableRecord[] };
    const templates: PromptTemplateSummary[] = (data.records ?? [])
      .map((record) => {
        const id = record.id ?? '';
        const name = fieldString(record.fields, 'Prompt Name', 'Name') || id;
        const category = fieldString(record.fields, 'Category') || undefined;
        const status = fieldString(record.fields, 'Status') || undefined;
        return { id, name, category, status };
      })
      .filter((t) => Boolean(t.id))
      .filter((t) => !t.status || t.status === 'Active' || t.status === 'Testing');

    return jsonOk({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list prompts';
    return jsonError(500, 'TEABLE_ERROR', message);
  }
}
