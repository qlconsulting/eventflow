/**
 * API pipeline orchestrator: Retriever → Katteb → Qolaba → Teable
 * Writes into Research_Runs, Thought_Leadership, Automation_Log (template schema).
 */

import type { Env, JwtClaims, OrchestrateRequest, OrchestrateResult } from '../types';
import { interpolateTemplate, jsonError, jsonOk } from '../utils/helpers';
import { resolveUserBase } from './teable';
import { scrapeTargetUrl } from './retriever';
import { generateFactualCopy } from './katteb';
import { generateAssets } from './qolaba';
import { syncOutboundCampaign } from './fuse';

const TEABLE_API_BASE = 'https://app.teable.io/api';

interface PromptParts {
  systemInstructions: string;
  refinedPrompt: string;
  name: string;
}

async function teableJson(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${TEABLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.TEABLE_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function fetchPromptTemplate(
  baseId: string,
  promptTemplateId: string,
  env: Env,
): Promise<PromptParts> {
  const result = await teableJson(
    env,
    `/base/${baseId}/table/Prompt_Library/record/${promptTemplateId}`,
  );

  if (result.status === 404) {
    throw Object.assign(new Error('Prompt template not found'), { status: 404 });
  }
  if (!result.ok) {
    throw Object.assign(new Error(`Failed to load prompt template (${result.status})`), {
      status: result.status,
    });
  }

  const fields = (result.data as { fields?: Record<string, unknown> })?.fields ?? {};
  const refined =
    (fields['Refined Prompt Template'] as string | undefined) ||
    (fields.Prompt as string | undefined) ||
    '';
  const system =
    (fields['System Instructions'] as string | undefined) ||
    (fields['System Instruction Template'] as string | undefined) ||
    '';
  const name = (fields['Prompt Name'] as string | undefined) || promptTemplateId;

  if (!refined) {
    throw Object.assign(new Error('Prompt template missing Refined Prompt Template'), {
      status: 500,
    });
  }

  return { systemInstructions: system, refinedPrompt: refined, name };
}

async function writeResearchRun(
  baseId: string,
  params: {
    runId: string;
    targetUrl: string;
    researchSummary: string;
    retrieverOutput: string;
    leadId?: string;
    status: 'Pending' | 'Complete' | 'Failed';
    errorMessage?: string;
  },
  env: Env,
): Promise<string | undefined> {
  const fields: Record<string, unknown> = {
    'Run ID': params.runId,
    'Source URL': params.targetUrl,
    'Trigger Source': 'Chrome Extension',
    'Retriever Output': params.retrieverOutput,
    'Research Summary': params.researchSummary,
    Status: params.status,
    Timestamp: new Date().toISOString(),
  };
  if (params.leadId) fields['Linked Lead'] = [{ id: params.leadId }];
  if (params.errorMessage) fields['Error Message'] = params.errorMessage;

  const result = await teableJson(env, `/base/${baseId}/table/Research_Runs/record`, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!result.ok) {
    throw Object.assign(new Error(`Research_Runs write failed (${result.status})`), {
      status: result.status,
    });
  }
  const records = (result.data as { records?: Array<{ id?: string }> })?.records;
  return records?.[0]?.id;
}

async function writeThoughtLeadership(
  baseId: string,
  params: {
    title: string;
    copyBody: string;
    promptTemplateId: string;
    leadId?: string;
    contentType: string;
  },
  env: Env,
): Promise<string | undefined> {
  const fields: Record<string, unknown> = {
    'Content Title': params.title,
    'Used Template': [{ id: params.promptTemplateId }],
    'Content Type': params.contentType,
    'Generated Copy': params.copyBody,
    'Content Status': 'Drafted',
  };
  if (params.leadId) fields['Linked Lead'] = [{ id: params.leadId }];

  const result = await teableJson(env, `/base/${baseId}/table/Thought_Leadership/record`, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!result.ok) {
    throw Object.assign(new Error(`Thought_Leadership write failed (${result.status})`), {
      status: result.status,
    });
  }
  const records = (result.data as { records?: Array<{ id?: string }> })?.records;
  return records?.[0]?.id;
}

async function writeAutomationLog(
  baseId: string,
  params: {
    logId: string;
    actionType: string;
    status: 'Pending' | 'Success' | 'Failed';
    summary: string;
    leadId?: string;
    contentId?: string;
    errorMessage?: string;
  },
  env: Env,
): Promise<string | undefined> {
  const fields: Record<string, unknown> = {
    'Log ID': params.logId,
    'Action Type': params.actionType,
    Status: params.status,
    Summary: params.summary,
    Timestamp: new Date().toISOString(),
  };
  if (params.leadId) fields['Related Lead'] = [{ id: params.leadId }];
  if (params.contentId) fields['Related Content'] = [{ id: params.contentId }];
  if (params.errorMessage) fields['Error Message'] = params.errorMessage;

  const result = await teableJson(env, `/base/${baseId}/table/Automation_Log/record`, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!result.ok) {
    throw Object.assign(new Error(`Automation_Log write failed (${result.status})`), {
      status: result.status,
    });
  }
  const records = (result.data as { records?: Array<{ id?: string }> })?.records;
  return records?.[0]?.id;
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

  try {
    const prompt = await fetchPromptTemplate(baseId, body.promptTemplateId, env);
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

    const result: OrchestrateResult = {
      research,
      copy,
      assets,
    };

    result.researchRunId = await writeResearchRun(
      baseId,
      {
        runId,
        targetUrl: body.targetUrl,
        researchSummary: research.summary,
        retrieverOutput: JSON.stringify(research.raw ?? research),
        leadId: body.leadId,
        status: 'Complete',
      },
      env,
    );

    result.thoughtLeadershipId = await writeThoughtLeadership(
      baseId,
      {
        title: copy.headline,
        copyBody: copy.body,
        promptTemplateId: body.promptTemplateId,
        leadId: body.leadId,
        contentType: inferContentType(prompt.name),
      },
      env,
    );

    if (body.options?.syncToFuse) {
      const fuse = await syncOutboundCampaign(copy, body.targetUrl, env);
      result.fuseCampaignId = fuse.campaignId;
    }

    result.automationLogId = await writeAutomationLog(
      baseId,
      {
        logId,
        actionType: 'Copy Generation',
        status: 'Success',
        summary: `Orchestrated ${prompt.name} for ${body.targetUrl}`,
        leadId: body.leadId,
        contentId: result.thoughtLeadershipId,
      },
      env,
    );

    return jsonOk({ status: 'completed', result });
  } catch (error) {
    const status = upstreamStatus(error);
    try {
      await writeAutomationLog(
        baseId,
        {
          logId,
          actionType: 'System',
          status: 'Failed',
          summary: 'Orchestration failed',
          leadId: body.leadId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        env,
      );
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
