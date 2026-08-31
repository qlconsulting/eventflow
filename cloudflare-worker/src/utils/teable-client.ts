/**
 * Low-level Teable HTTP client (app.teable.ai).
 */

import type { Env } from '../types';

export const DEFAULT_TEABLE_API_BASE = 'https://app.teable.ai/api';

export function teableApiBase(env: Env): string {
  return (env.TEABLE_API_BASE_URL || DEFAULT_TEABLE_API_BASE).replace(/\/+$/, '');
}

export interface TeableRecord {
  id?: string;
  fields?: Record<string, unknown>;
  name?: string;
}

export async function teableFetch(
  env: Env,
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<Response> {
  const qs = options.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : '';
  return fetch(`${teableApiBase(env)}${path}${qs}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${env.TEABLE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export function fieldString(
  fields: Record<string, unknown> | undefined,
  ...keys: string[]
): string {
  if (!fields) return '';
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

export function statusFromError(error: unknown): number {
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status: number }).status);
  }
  return 500;
}

export async function createRecordsByTableId(
  env: Env,
  tableId: string,
  records: Array<{ fields: Record<string, unknown> }>,
): Promise<TeableRecord[]> {
  const res = await teableFetch(env, `/table/${tableId}/record`, {
    method: 'POST',
    query: { fieldKeyType: 'name' },
    body: { records, fieldKeyType: 'name', typecast: true },
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
 * List tables in a base and return name → id map.
 * Used after folder-scoped duplicate (new IDs every time).
 */
export async function discoverTablesByName(
  env: Env,
  baseId: string,
): Promise<Record<string, string>> {
  const res = await teableFetch(env, `/base/${baseId}/table`);
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Failed to list tables for base ${baseId}: ${text}`), {
      status: res.status,
    });
  }
  const data = (await res.json()) as TeableRecord[] | { tables?: TeableRecord[] };
  const tables = Array.isArray(data) ? data : (data.tables ?? []);
  const map: Record<string, string> = {};
  for (const table of tables) {
    const name = table.name ?? fieldString(table.fields, 'name', 'Name');
    const id = table.id;
    if (name && id) map[name] = id;
  }
  return map;
}

export async function createRecordsInBaseTable(
  env: Env,
  baseId: string,
  tableName: string,
  records: Array<{ fields: Record<string, unknown> }>,
  tableMap?: Record<string, string>,
): Promise<TeableRecord[]> {
  const map = tableMap ?? (await discoverTablesByName(env, baseId));
  const tableId = map[tableName];
  if (!tableId) {
    // Fallback: name-based path (if Teable supports it)
    const res = await teableFetch(env, `/base/${baseId}/table/${encodeURIComponent(tableName)}/record`, {
      method: 'POST',
      query: { fieldKeyType: 'name' },
      body: { records, fieldKeyType: 'name', typecast: true },
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(
        new Error(`Table ${tableName} not found in base ${baseId}: ${text}`),
        { status: res.status },
      );
    }
    const data = (await res.json()) as { records?: TeableRecord[] };
    return data.records ?? [];
  }
  return createRecordsByTableId(env, tableId, records);
}
