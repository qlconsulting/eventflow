/**
 * HTTP router for The Leverage Lab Worker.
 */

import type { Env, DashformOnboardingPayload, OrchestrateRequest } from './types';
import { verifyUserJwt } from './utils/auth';
import { jsonError, jsonOk } from './utils/helpers';
import { handleOnboarding, listPromptTemplates } from './services/teable';
import { runOrchestration } from './services/orchestrator';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'GET' && (path === '/api/health' || path === '/health')) {
    return jsonOk({ status: 'ok', service: 'the-leverage-lab-api', env: env.ENVIRONMENT });
  }

  if (request.method === 'POST' && path === '/api/onboarding') {
    let body: DashformOnboardingPayload;
    try {
      body = (await request.json()) as DashformOnboardingPayload;
    } catch {
      return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }
    return handleOnboarding(body, env);
  }

  if (request.method === 'GET' && path === '/api/prompts') {
    const auth = await verifyUserJwt(request, env);
    if (!auth.ok) {
      return jsonError(401, 'UNAUTHORIZED', auth.message);
    }
    return listPromptTemplates(auth.claims, env);
  }

  if (request.method === 'POST' && path === '/api/orchestrate') {
    const auth = await verifyUserJwt(request, env);
    if (!auth.ok) {
      return jsonError(401, 'UNAUTHORIZED', auth.message);
    }

    let body: OrchestrateRequest;
    try {
      body = (await request.json()) as OrchestrateRequest;
    } catch {
      return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    if (!body.promptTemplateId || !body.targetUrl) {
      return jsonError(400, 'VALIDATION_ERROR', 'promptTemplateId and targetUrl are required');
    }

    return runOrchestration(body, auth.claims, env);
  }

  return jsonError(404, 'NOT_FOUND', `No route for ${request.method} ${path}`);
}
