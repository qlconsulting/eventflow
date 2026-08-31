/**
 * API pipeline orchestrator: Retriever → Katteb → Qolaba → Teable
 * Writes into Research_Runs, Thought_Leadership, Automation_Log.
 * Discovers client table IDs by name (IDs differ after each provision).
 */

import type { Env, JwtClaims, OrchestrateRequest, OrchestrateResult } from '../types';
import { interpolateTemplate, jsonError, jsonOk } from '../utils/helpers';
import {
  createRecordsByTableId,
  discoverTablesByName,
  fieldString,
  teableFetch,
} from '../utils/teable-client';
import { resolveUserBase } from './teable';
import { scrapeTargetUrl } from './retriever';
import { generateFactualCopy } from './katteb';
import { generateAssets } from './qolaba';
import { syncOutboundCampaign } from './fuse';

interface PromptParts {
  systemInstructions: string;
  refinedPrompt: string;
  name: string;
}

async function fetchPromptTemplate(
  promptTableId: string,
  promptTemplateId: string,
  env: Env,
): Promise<PromptParts> {
  const res = await teableFetch(env, `/table/${promptTableId}/record/${promptTemplateId}`, {
    query: { fieldKeyType: 'name' },
  });

  if (res.status === 404) {
    throw Object.assign(new Error('Prompt template not found'), { status: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to load prompt template (${res.status})`), {
      status: res.status,
    });
  }

  const data = (await res.json()) as { fields?: Record<string, unknown> };
  const fields = data.fields ?? {};
  const refined = fieldString(fields, 'Refined Prompt Template', 'Prompt');
  const system = fieldString(fields, 'System Instructions', 'System Instruction Template');
  const name = fieldString(fields, 'Prompt Name') || promptTemplateId;

  if (!refined) {
    throw Object.assign(new Error('Prompt template missing Refined Prompt Template'), {
      status: 500,
    });
  }

  return { systemInstructions: system, refinedPrompt: refined, name };
}

function inferContentType(promptName: string): string {
  const lower = promptName.toLowerCase();
  if (lower.includes('email')) return 'Email Newsletter';
  if (lower.includes('linkedin') || lower.includes('thought leadership')) return 'LinkedIn Post';
  if (lower.includes('case study')) return 'Case Study';
  if (lower.includes('website')) return 'Website Insight';
  if (lower.includes('report')) return 'Executive Report';
  if (lower.includes('blog')) return 'Blog Post';
  return 'LinkedIn Post';
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

  const baseId = baseOrError.assignedBaseId;
  const runId = `run_${Date.now()}`;
  const logId = `log_${Date.now()}`;

  let tableMap: Record<string, string> = {};

  try {
    tableMap = await discoverTablesByName(env, baseId);
    const promptTableId = tableMap.Prompt_Library;
    if (!promptTableId) {
      return jsonError(404, 'NOT_FOUND', 'Prompt_Library not found in assigned base');
    }

    const prompt = await fetchPromptTemplate(promptTableId, body.promptTemplateId, env);
    const research = await scrapeTargetUrl(body.targetUrl, env);

    const vars: Record<string, string> = {
      company_context: research.summary,
      website_findings: research.summary,
      brand_tone: '',
      executive_name: baseOrError.fullName ?? '',
      company_name: baseOrError.companyName ?? '',
      target_audience: '',
      core_offer: '',
      primary_pain_point: '',
    };

    const compiledBody = interpolateTemplate(prompt.refinedPrompt, vars);
    const compiledSystem = interpolateTemplate(prompt.systemInstructions, vars);
    const fullTemplate = `${compiledSystem}\n\n${compiledBody}`.trim();

    const copy = await generateFactualCopy(research, fullTemplate, env);
    const assets = await generateAssets(copy, env, {
      visuals: body.options?.generateVisuals !== false,
      audio: body.options?.generateAudio === true,
    });

    const result: OrchestrateResult = { research, copy, assets };

    if (tableMap.Research_Runs) {
      const researchFields: Record<string, unknown> = {
        'Run ID': runId,
        'Source URL': body.targetUrl,
        'Trigger Source': 'Chrome Extension',
        'Retriever Output': JSON.stringify(research.raw ?? research),
        'Research Summary': research.summary,
        Status: 'Complete',
        Timestamp: new Date().toISOString(),
      };
      if (body.leadId) researchFields['Linked Lead'] = [{ id: body.leadId }];
      const created = await createRecordsByTableId(env, tableMap.Research_Runs, [
        { fields: researchFields },
      ]);
      result.researchRunId = created[0]?.id;
    }

    if (tableMap.Thought_Leadership) {
      const tlFields: Record<string, unknown> = {
        'Content Title': copy.headline,
        'Used Template': [{ id: body.promptTemplateId }],
        'Content Type': inferContentType(prompt.name),
        'Generated Copy': copy.body,
        'Content Status': 'Drafted',
      };
      if (body.leadId) tlFields['Linked Lead'] = [{ id: body.leadId }];
      const created = await createRecordsByTableId(env, tableMap.Thought_Leadership, [
        { fields: tlFields },
      ]);
      result.thoughtLeadershipId = created[0]?.id;
    }

    if (body.options?.syncToFuse) {
      const fuse = await syncOutboundCampaign(copy, body.targetUrl, env);
      result.fuseCampaignId = fuse.campaignId;
    }

    if (tableMap.Automation_Log) {
      const logFields: Record<string, unknown> = {
        'Log ID': logId,
        'Action Type': 'Copy Generation',
        Status: 'Success',
        Summary: `Orchestrated ${prompt.name} for ${body.targetUrl}`,
        Timestamp: new Date().toISOString(),
      };
      if (body.leadId) logFields['Related Lead'] = [{ id: body.leadId }];
      if (result.thoughtLeadershipId) {
        logFields['Related Content'] = [{ id: result.thoughtLeadershipId }];
      }
      const created = await createRecordsByTableId(env, tableMap.Automation_Log, [
        { fields: logFields },
      ]);
      result.automationLogId = created[0]?.id;
    }

    return jsonOk({ status: 'completed', result });
  } catch (error) {
    const status = upstreamStatus(error);
    try {
      if (tableMap.Automation_Log) {
        await createRecordsByTableId(env, tableMap.Automation_Log, [
          {
            fields: {
              'Log ID': logId,
              'Action Type': 'System',
              Status: 'Failed',
              Summary: 'Orchestration failed',
              'Error Message': error instanceof Error ? error.message : 'Unknown error',
              Timestamp: new Date().toISOString(),
              ...(body.leadId ? { 'Related Lead': [{ id: body.leadId }] } : {}),
            },
          },
        ]);
      }
    } catch {
      // best-effort
    }

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
