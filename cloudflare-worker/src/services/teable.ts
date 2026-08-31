/**
 * Teable API integrations — client registry, base cloning, prompt injection.
 */

import type {
  ClientRegistryRecord,
  DashformOnboardingPayload,
  Env,
  JwtClaims,
} from '../types';
import { verifyDashformSecret } from '../utils/auth';
import { compileBrandTonePrompt, jsonError, jsonOk } from '../utils/helpers';

const TEABLE_API_BASE = 'https://app.teable.io/api';

interface TeableRequestOptions {
  method?: string;
  body?: unknown;
  baseId?: string;
}

async function teableFetch(
  env: Env,
  path: string,
  options: TeableRequestOptions = {},
): Promise<Response> {
  const url = `${TEABLE_API_BASE}${path}`;
  return fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${env.TEABLE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Look up an executive's assigned Teable base ID from the master registry.
 */
export async function lookupAssignedBaseId(
  email: string,
  env: Env,
): Promise<ClientRegistryRecord | null> {
  const tableId = env.TEABLE_MASTER_TABLE_ID;
  const filter = encodeURIComponent(`{Email}="${email.replace(/"/g, '\\"')}"`);
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
    const data = (await res.json()) as {
      records?: Array<{ fields?: Record<string, unknown> }>;
    };
    const fields = data.records?.[0]?.fields;
    if (!fields) return null;

    const assignedBaseId = String(fields['Assigned Base ID'] ?? fields.assignedBaseId ?? '');
    if (!assignedBaseId) return null;

    return {
      email,
      assignedBaseId,
      companyName: fields['Company Name'] ? String(fields['Company Name']) : undefined,
      fullName: fields['Full Name'] ? String(fields['Full Name']) : undefined,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Teable registry lookup error'), { cause: error });
  }
}

/**
 * Clone the master Teable workspace/base for a new client.
 * Implementation depends on Teable's clone/duplicate API; this is the integration seam.
 */
export async function cloneMasterBase(
  companyName: string,
  env: Env,
): Promise<{ baseId: string }> {
  try {
    const res = await teableFetch(env, `/base/${env.TEABLE_MASTER_BASE_ID}/duplicate`, {
      method: 'POST',
      body: {
        name: `Leverage Lab — ${companyName}`,
      },
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Teable rate limited while cloning'), { status: 429 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Base clone failed: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as { id?: string; baseId?: string };
    const baseId = data.id ?? data.baseId;
    if (!baseId) {
      throw new Error('Clone response missing base id');
    }
    return { baseId };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Failed to clone master base'), { cause: error });
  }
}

/**
 * Inject compiled brand prompts into the new base's Prompt_Library table.
 */
export async function injectPromptLibrary(
  baseId: string,
  systemPrompt: string,
  env: Env,
): Promise<void> {
  try {
    // Table name resolution may require a prior schema lookup; path is a stable seam.
    const res = await teableFetch(env, `/base/${baseId}/table/Prompt_Library/record`, {
      method: 'POST',
      body: {
        records: [
          {
            fields: {
              Name: 'Brand System Prompt',
              Prompt: systemPrompt,
              Category: 'system',
            },
          },
        ],
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Prompt inject failed: ${text}`), { status: res.status });
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Failed to inject Prompt_Library'), { cause: error });
  }
}

/**
 * Register the new client in the master directory table.
 */
export async function registerClientInMaster(
  payload: DashformOnboardingPayload,
  assignedBaseId: string,
  env: Env,
): Promise<void> {
  const res = await teableFetch(env, `/table/${env.TEABLE_MASTER_TABLE_ID}/record`, {
    method: 'POST',
    body: {
      records: [
        {
          fields: {
            Email: payload.email,
            'Full Name': payload.fullName,
            'Company Name': payload.companyName,
            'Assigned Base ID': assignedBaseId,
            'Brand Tone': payload.brandTone,
            Website: payload.websiteUrl ?? '',
          },
        },
      ],
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Client registration failed: ${text}`), { status: res.status });
  }
}

/**
 * Dashform `/api/onboarding` handler.
 */
export async function handleOnboarding(
  payload: DashformOnboardingPayload,
  env: Env,
): Promise<Response> {
  if (!verifyDashformSecret(payload.webhookSecret, env)) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid Dashform webhook secret');
  }

  if (!payload.email || !payload.fullName || !payload.companyName || !payload.brandTone) {
    return jsonError(
      400,
      'VALIDATION_ERROR',
      'email, fullName, companyName, and brandTone are required',
    );
  }

  try {
    const existing = await lookupAssignedBaseId(payload.email, env);
    if (existing) {
      return jsonOk({
        status: 'already_registered',
        email: existing.email,
        assignedBaseId: existing.assignedBaseId,
      });
    }

    const { baseId } = await cloneMasterBase(payload.companyName, env);
    const systemPrompt = compileBrandTonePrompt(payload.brandTone, payload.brandVoiceNotes);
    await injectPromptLibrary(baseId, systemPrompt, env);
    await registerClientInMaster(payload, baseId, env);

    return jsonOk(
      {
        status: 'onboarded',
        email: payload.email,
        assignedBaseId: baseId,
      },
      201,
    );
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
    if (status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    const message = error instanceof Error ? error.message : 'Onboarding failed';
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
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 500;
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
}

/**
 * List prompt templates from the executive's private Prompt_Library table.
 */
export async function listPromptTemplates(
  claims: JwtClaims,
  env: Env,
): Promise<Response> {
  const baseOrError = await resolveUserBase(claims, env);
  if (baseOrError instanceof Response) return baseOrError;

  try {
    const res = await teableFetch(
      env,
      `/base/${baseOrError.assignedBaseId}/table/Prompt_Library/record?take=100`,
    );

    if (res.status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream Teable rate limit');
    }
    if (!res.ok) {
      return jsonError(res.status, 'TEABLE_ERROR', `Failed to list prompts (${res.status})`);
    }

    const data = (await res.json()) as {
      records?: Array<{ id?: string; fields?: Record<string, unknown> }>;
    };

    const templates: PromptTemplateSummary[] = (data.records ?? [])
      .map((record) => {
        const id = record.id ?? '';
        const name = String(record.fields?.Name ?? record.fields?.name ?? id);
        const category = record.fields?.Category
          ? String(record.fields.Category)
          : record.fields?.category
            ? String(record.fields.category)
            : undefined;
        return { id, name, category };
      })
      .filter((t) => Boolean(t.id));

    return jsonOk({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list prompts';
    return jsonError(500, 'TEABLE_ERROR', message);
  }
}
