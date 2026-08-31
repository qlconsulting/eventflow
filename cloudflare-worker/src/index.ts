/**
 * Cloudflare Worker entry — The Leverage Lab API proxy.
 * Routes all traffic through the modular router; injects secrets via `env`.
 */

import type { Env } from './types';
import { handleRequest } from './router';
import { corsHeaders, handleOptions } from './utils/helpers';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    try {
      const response = await handleRequest(request, env);
      const origin = request.headers.get('Origin');
      const headers = new Headers(response.headers);
      const cors = corsHeaders(origin, env);
      for (const [key, value] of Object.entries(cors)) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return new Response(JSON.stringify({ error: 'SERVER_ERROR', message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request.headers.get('Origin'), env),
        },
      });
    }
  },
};
