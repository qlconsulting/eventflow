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

/**
 * Fallback tone rules aligned with Tone_Persona_Matrix seed data.
 * Prefer fetching live Voice Rules from Teable when available.
 */
export function compileBrandTonePrompt(tone: string, notes?: string): string {
  const toneMap: Record<string, string> = {
    'visionary/inspirational':
      'Voice: Future-focused, optimistic, authoritative, thoughtful, and strategic. Open with a market shift, future trend, or transformation insight. Use clear executive language and human-centered insight. Avoid hype, empty futurism, generic AI phrasing, buzzwords, and emojis.',
    'direct/opinionated':
      'Voice: Concise, sharp, practical, confident, and slightly contrarian. Open with a hard truth or challenge to conventional wisdom. Use short paragraphs and decisive language. Avoid hedging, academic over-explaining, fluffy intros, and generic summaries.',
    'academic/analytical':
      'Voice: Evidence-based, structured, calm, rational, and precise. Open with a statistic, operational pattern, or measurable implication. Use frameworks and ROI-oriented language. Avoid unsupported claims, overstatement, emotional hype, and vague advice.',
    'bold/provocative':
      'Voice: Challenging, engaging, narrative-driven, and memorable. Open with a polarizing observation or industry bottleneck story. Use contrast and punchy transitions. Avoid being reckless, offensive, inflammatory, or clickbait-heavy.',
  };

  const normalized = tone.trim().toLowerCase();
  const base =
    toneMap[normalized] ??
    `Adopt the brand tone "${tone}". Stay clear, executive-grade, specific, and human. Avoid generic AI phrasing and emojis.`;

  const extra = notes?.trim() ? `\nAdditional brand voice notes: ${notes.trim()}` : '';
  return `${base}${extra}`;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return vars[key] ?? '';
  });
}

export function truncate(text: string, max = 500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
