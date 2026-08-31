/**
 * Teable integrations — Executive_Directory, folder-scoped template provision,
 * Prompt_Library, Provisioning_Log, Tone_Persona_Matrix.
 *
 * CRITICAL: Template tables live in a FOLDER inside Master Control.
 * Never duplicate the whole Master Control base. Use:
 *   POST /base/duplicate { fromBaseId, spaceId, nodes: [templateFolderId], withRecords }
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
import {
  createRecordsByTableId,
  createRecordsInBaseTable,
  discoverTablesByName,
  fieldString,
  statusFromError,
  teableFetch,
  type TeableRecord,
} from '../utils/teable-client';

const TEMPLATE_TABLE_NAMES = [
  'Client_Profile',
  'Web_Properties',
  'Prompt_Library',
  'Inbox_Leads',
  'Research_Runs',
  'Thought_Leadership',
  'Outreach_Queue',
  'Asset_Library',
  'Automation_Log',
] as const;

/**
 * Look up an executive in Executive_Directory by Executive Email.
 */
export async function lookupAssignedBaseId(
  email: string,
  env: Env,
): Promise<ClientRegistryRecord | null> {
  const tableId = env.TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID;
  const filter = encodeURIComponent(`{Executive Email}="${email.replace(/"/g, '\\"')}"`);

  try {
    const res = await teableFetch(env, `/table/${tableId}/record`, {
      query: { filter, take: '1', fieldKeyType: 'name' },
    });
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
  if (!env.TEABLE_PROVISIONING_LOG_TABLE_ID) return;

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

  await createRecordsByTableId(env, env.TEABLE_PROVISIONING_LOG_TABLE_ID, [{ fields }]);
}

/**
 * Duplicate ONLY the template folder node into a new client base.
 * Requires TEABLE_SPACE_ID. Never clones full Master Control.
 */
export async function provisionClientWorkspace(
  companyName: string,
  executiveName: string,
  env: Env,
): Promise<{ baseId: string; tableMap: Record<string, string> }> {
  if (!env.TEABLE_SPACE_ID || env.TEABLE_SPACE_ID.startsWith('PENDING_')) {
    throw Object.assign(
      new Error('TEABLE_SPACE_ID is not configured — cannot provision client bases'),
      { status: 500 },
    );
  }
  if (!env.TEABLE_TEMPLATE_FOLDER_ID) {
    throw Object.assign(new Error('TEABLE_TEMPLATE_FOLDER_ID is not configured'), {
      status: 500,
    });
  }
  if (!env.TEABLE_MASTER_BASE_ID) {
    throw Object.assign(new Error('TEABLE_MASTER_BASE_ID is not configured'), { status: 500 });
  }

  const res = await teableFetch(env, '/base/duplicate', {
    method: 'POST',
    body: {
      fromBaseId: env.TEABLE_MASTER_BASE_ID,
      spaceId: env.TEABLE_SPACE_ID,
      name: `The Leverage Lab — ${executiveName} (${companyName})`,
      withRecords: true,
      nodes: [env.TEABLE_TEMPLATE_FOLDER_ID],
      timeZone: env.DEFAULT_TIMEZONE || 'America/Los_Angeles',
    },
  });

  if (res.status === 429) {
    throw Object.assign(new Error('Teable rate limited while provisioning'), { status: 429 });
  }
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Folder-scoped base duplicate failed: ${text}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { id?: string; baseId?: string; name?: string };
  const baseId = data.id ?? data.baseId;
  if (!baseId) {
    throw new Error('Duplicate response missing base id');
  }

  const tableMap = await discoverTablesByName(env, baseId);
  const missing = TEMPLATE_TABLE_NAMES.filter((n) => !tableMap[n]);
  if (missing.length > 0) {
    // Soft warning — continue; some Teable responses nest folders differently
    console.warn(
      `Provisioned base ${baseId} missing expected tables: ${missing.join(', ')}. Found: ${Object.keys(tableMap).join(', ')}`,
    );
  }

  return { baseId, tableMap };
}

export async function createClientProfile(
  baseId: string,
  intake: OnboardingIntake,
  env: Env,
  tableMap?: Record<string, string>,
): Promise<string | undefined> {
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

  const created = await createRecordsInBaseTable(
    env,
    baseId,
    'Client_Profile',
    [{ fields }],
    tableMap,
  );
  return created[0]?.id;
}

export async function fetchTonePersona(
  brandTone: string,
  env: Env,
): Promise<{
  voiceRules: string;
  openingHookStyle?: string;
  writingRules?: string;
  avoidList?: string;
} | null> {
  const tableId = env.TEABLE_TONE_PERSONA_MATRIX_TABLE_ID;
  if (!tableId) return null;

  const filter = encodeURIComponent(`{Tone Name}="${brandTone.replace(/"/g, '\\"')}"`);
  const res = await teableFetch(env, `/table/${tableId}/record`, {
    query: { filter, take: '1', fieldKeyType: 'name' },
  });
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
 * Apply brand-tone overlay onto Prompt_Library rows already copied withRecords.
 * If library is empty, seed from Master_Prompt_Templates.
 */
export async function ensurePromptLibraryTone(
  baseId: string,
  intake: OnboardingIntake,
  env: Env,
  tableMap?: Record<string, string>,
): Promise<number> {
  const map = tableMap ?? (await discoverTablesByName(env, baseId));
  const promptTableId = map.Prompt_Library;

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

  if (promptTableId) {
    const list = await teableFetch(env, `/table/${promptTableId}/record`, {
      query: { take: '100', fieldKeyType: 'name' },
    });
    if (list.ok) {
      const data = (await list.json()) as { records?: TeableRecord[] };
      const records = data.records ?? [];
      if (records.length > 0) {
        // Append tone block via patch when records exist from withRecords clone
        let updated = 0;
        for (const record of records) {
          if (!record.id) continue;
          const existing = fieldString(record.fields, 'System Instructions');
          if (existing.includes(`Brand Tone (${intake.brandTone})`)) {
            updated += 1;
            continue;
          }
          const systemInstructions = [
            existing,
            `\n--- Brand Tone (${intake.brandTone}) ---\n${toneBlock}`,
          ]
            .filter(Boolean)
            .join('\n');
          const patch = await teableFetch(env, `/table/${promptTableId}/record/${record.id}`, {
            method: 'PATCH',
            query: { fieldKeyType: 'name' },
            body: {
              record: { fields: { 'System Instructions': systemInstructions } },
              fieldKeyType: 'name',
              typecast: true,
            },
          });
          if (patch.ok) updated += 1;
        }
        return updated;
      }
    }
  }

  // Seed from Master_Prompt_Templates when clone brought no prompt rows
  const masterTableId = env.TEABLE_MASTER_PROMPT_TEMPLATES_TABLE_ID;
  const filter = encodeURIComponent('{Active}=true');
  const res = await teableFetch(env, `/table/${masterTableId}/record`, {
    query: { filter, take: '100', fieldKeyType: 'name' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Master_Prompt_Templates read failed: ${text}`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { records?: TeableRecord[] };
  const seedRecords = (data.records ?? []).map((record) => {
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

  if (seedRecords.length === 0) {
    await createRecordsInBaseTable(
      env,
      baseId,
      'Prompt_Library',
      [
        {
          fields: {
            'Prompt Name': 'Brand System Prompt',
            Category: 'Research Synthesis',
            'System Instructions': toneBlock,
            'Refined Prompt Template': '{{company_context}}',
            'Required Variables': '{{company_context}}',
            Status: 'Active',
            'Template Version': 'v1.0',
            'Last Updated': new Date().toISOString(),
          },
        },
      ],
      map,
    );
    return 1;
  }

  await createRecordsInBaseTable(env, baseId, 'Prompt_Library', seedRecords, map);
  return seedRecords.length;
}

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
    'Web Management Client': intake.webManagementClient,
    'Onboarding Date': new Date().toISOString(),
  };
  if (intake.companyWebsite) fields['Company Website'] = intake.companyWebsite;
  if (intake.executiveLinkedIn) fields['Executive LinkedIn'] = intake.executiveLinkedIn;
  if (intake.managedDomain) fields['Domain Mapped'] = intake.managedDomain;
  if (options.errorMessage) fields['Last Provisioning Error'] = options.errorMessage;

  const created = await createRecordsByTableId(env, env.TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID, [
    { fields },
  ]);
  return created[0]?.id;
}

export async function handleOnboarding(rawBody: unknown, env: Env): Promise<Response> {
  const parsed = parseDashformPayload(rawBody);
  if (!parsed.ok) {
    return jsonError(400, 'VALIDATION_ERROR', parsed.message);
  }

  const { intake, envelope } = parsed;
  if (!verifyDashformSecret(envelope.webhookSecret, env)) {
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

    const { baseId, tableMap } = await provisionClientWorkspace(
      intake.companyName,
      intake.executiveName,
      env,
    );
    await writeProvisioningLog(env, {
      eventId,
      source: 'Worker',
      step: 'Template Base Cloned',
      status: 'Success',
      payloadSnapshot: { baseId, tables: tableMap, mode: 'folder-scoped-duplicate' },
    });

    await createClientProfile(baseId, intake, env, tableMap);
    await writeProvisioningLog(env, {
      eventId,
      source: 'Worker',
      step: 'Client Profile Created',
      status: 'Success',
    });

    const seeded = await ensurePromptLibraryTone(baseId, intake, env, tableMap);
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
        teableBaseUrl: `https://app.teable.ai/base/${baseId}`,
        templatesSeeded: seeded,
        tableMap,
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
      // best-effort
    }

    if (status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    return jsonError(status >= 400 && status < 600 ? status : 500, 'ONBOARDING_ERROR', message);
  }
}

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

export async function listPromptTemplates(
  claims: JwtClaims,
  env: Env,
): Promise<Response> {
  const baseOrError = await resolveUserBase(claims, env);
  if (baseOrError instanceof Response) return baseOrError;

  try {
    const tableMap = await discoverTablesByName(env, baseOrError.assignedBaseId);
    const promptTableId = tableMap.Prompt_Library;
    if (!promptTableId) {
      return jsonError(404, 'NOT_FOUND', 'Prompt_Library table not found in assigned base');
    }

    const res = await teableFetch(env, `/table/${promptTableId}/record`, {
      query: { take: '100', fieldKeyType: 'name' },
    });
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
