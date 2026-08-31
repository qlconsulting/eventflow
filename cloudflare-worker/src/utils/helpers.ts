/**
 * CORS middleware, JSON helpers, and prompt compilation utilities.
 */

import type { Env } from '../types';

const DEFAULT_ALLOWED = ['https://app.theleveragelab.com'];

export function parseAllowedOrigins(env: Env): string[] {
  if (!env.ALLOWED_ORIGINS) return DEFAULT_ALLOWED;
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return true; // same-origin / non-browser clients
  const allowed = parseAllowedOrigins(env);
  return allowed.includes(origin) || allowed.includes('*');
}

export function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = isOriginAllowed(origin, env);
  const allowOrigin = allowed && origin ? origin : parseAllowedOrigins(env)[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function handleOptions(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin, env)) {
    return new Response(JSON.stringify({ error: 'CORS_DENIED', message: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(
  status: number,
  error: string,
  message: string,
  details?: unknown,
): Response {
  return new Response(JSON.stringify({ error, message, details }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Map brand tone selections from Dashform into system prompt fragments. */
export function compileBrandTonePrompt(tone: string, notes?: string): string {
  const toneMap: Record<string, string> = {
    authoritative: 'Write with decisive, executive authority. Prefer short declarative sentences.',
    warm: 'Write with approachable warmth while remaining professional and credible.',
    analytical: 'Lead with data, precision, and clear causal reasoning.',
    bold: 'Be assertive and high-conviction; avoid hedging language.',
    consultative: 'Sound like a trusted advisor: curious, structured, and outcome-focused.',
  };

  const normalized = tone.trim().toLowerCase();
  const base =
    toneMap[normalized] ??
    `Adopt a brand tone described as "${tone}". Stay clear, executive-grade, and persuasive.`;

  const extra = notes?.trim() ? `\nAdditional voice notes: ${notes.trim()}` : '';
  return `${base}${extra}`;
}

export function truncate(text: string, max = 500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
