/**
 * API pipeline orchestrator: Retriever → Katteb → Qolaba → Teable (+ optional Fuse).
 */

import type { Env, JwtClaims, OrchestrateRequest, OrchestrateResult } from '../types';
import { jsonError, jsonOk } from '../utils/helpers';
import { resolveUserBase } from './teable';
import { scrapeTargetUrl } from './retriever';
import { generateFactualCopy } from './katteb';
import { generateAssets } from './qolaba';
import { syncOutboundCampaign } from './fuse';

async function fetchPromptTemplate(
  baseId: string,
  promptTemplateId: string,
  env: Env,
): Promise<string> {
  const res = await fetch(
    `https://app.teable.io/api/base/${baseId}/table/Prompt_Library/record/${promptTemplateId}`,
    {
      headers: {
        Authorization: `Bearer ${env.TEABLE_API_KEY}`,
        Accept: 'application/json',
      },
    },
  );

  if (res.status === 404) {
    throw Object.assign(new Error('Prompt template not found'), { status: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to load prompt template (${res.status})`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { fields?: Record<string, unknown> };
  const prompt = data.fields?.Prompt ?? data.fields?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw Object.assign(new Error('Prompt template missing Prompt field'), { status: 500 });
  }
  return prompt;
}

async function writeResultToTeable(
  baseId: string,
  result: OrchestrateResult,
  env: Env,
): Promise<string | undefined> {
  const res = await fetch(`https://app.teable.io/api/base/${baseId}/table/Outputs/record`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TEABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            Research: JSON.stringify(result.research),
            Copy: JSON.stringify(result.copy),
            Assets: result.assets ? JSON.stringify(result.assets) : '',
            FuseCampaignId: result.fuseCampaignId ?? '',
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Teable write failed (${res.status})`), { status: res.status });
  }

  const data = (await res.json()) as { records?: Array<{ id?: string }> };
  return data.records?.[0]?.id;
}

function upstreamStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status: number }).status);
  }
  return null;
}

export async function runOrchestration(
  body: OrchestrateRequest,
  claims: JwtClaims,
  env: Env,
): Promise<Response> {
  const baseOrError = await resolveUserBase(claims, env);
  if (baseOrError instanceof Response) return baseOrError;

  try {
    const promptTemplate = await fetchPromptTemplate(
      baseOrError.assignedBaseId,
      body.promptTemplateId,
      env,
    );

    const research = await scrapeTargetUrl(body.targetUrl, env);
    const copy = await generateFactualCopy(research, promptTemplate, env);

    const assets = await generateAssets(copy, env, {
      visuals: body.options?.generateVisuals !== false,
      audio: body.options?.generateAudio === true,
    });

    const result: OrchestrateResult = {
      research,
      copy,
      assets,
    };

    if (body.options?.syncToFuse) {
      const fuse = await syncOutboundCampaign(copy, body.targetUrl, env);
      result.fuseCampaignId = fuse.campaignId;
    }

    result.teableRecordId = await writeResultToTeable(baseOrError.assignedBaseId, result, env);

    return jsonOk({ status: 'completed', result });
  } catch (error) {
    const status = upstreamStatus(error);
    if (status === 429) {
      return jsonError(429, 'RATE_LIMITED', 'Upstream provider rate limited the request');
    }
    if (status === 401) {
      return jsonError(401, 'UNAUTHORIZED', 'Upstream provider rejected credentials');
    }
    if (status === 404) {
      return jsonError(404, 'NOT_FOUND', error instanceof Error ? error.message : 'Not found');
    }
    const message = error instanceof Error ? error.message : 'Orchestration failed';
    return jsonError(500, 'ORCHESTRATION_ERROR', message);
  }
}
