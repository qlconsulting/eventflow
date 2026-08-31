/**
 * Upsert non-secret Global_System_Variables rows.
 * Usage (local, with TEABLE_API_KEY in env):
 *   node --experimental-strip-types scripts/seed-global-vars.mjs
 * Or: TEABLE_API_KEY=... npm run seed:gsv  (once wired)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, '../config/global-system-variables.seed.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));

// Prefer process.env; fall back to cloudflare-worker/.dev.vars (gitignored)
function loadDevVars() {
  const p = resolve(__dirname, '../cloudflare-worker/.dev.vars');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

const devVars = loadDevVars();
const apiKey = process.env.TEABLE_API_KEY || devVars.TEABLE_API_KEY;
const apiBase = (
  process.env.TEABLE_API_BASE_URL ||
  devVars.TEABLE_API_BASE_URL ||
  'https://app.teable.ai/api'
).replace(/\/+$/, '');

if (!apiKey) {
  console.error('Missing TEABLE_API_KEY');
  process.exit(1);
}

async function teable(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return data;
}

async function main() {
  const tableId = seed.tableId;
  const existing = await teable(
    `/table/${tableId}/record?take=200&fieldKeyType=name`,
  );
  const byKey = new Map();
  for (const rec of existing.records || []) {
    const key = rec.fields?.['Variable Key'];
    if (key) byKey.set(String(key), rec);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of seed.rows) {
    const key = row['Variable Key'];
    const found = byKey.get(key);
    if (!found) {
      await teable(`/table/${tableId}/record?fieldKeyType=name`, {
        method: 'POST',
        body: JSON.stringify({
          records: [{ fields: row }],
          fieldKeyType: 'name',
          typecast: true,
        }),
      });
      created += 1;
      console.log(`created ${key}`);
      continue;
    }

    const curVal = String(found.fields?.['Variable Value'] ?? '');
    const nextVal = String(row['Variable Value'] ?? '');
    // Do not overwrite a real TEABLE_SPACE_ID / non-TBD value with TBD
    if (curVal && curVal !== 'TBD' && nextVal === 'TBD') {
      skipped += 1;
      console.log(`skipped ${key} (keeps existing non-TBD value)`);
      continue;
    }
    if (curVal === nextVal && String(found.fields?.Description ?? '') === String(row.Description ?? '')) {
      skipped += 1;
      console.log(`unchanged ${key}`);
      continue;
    }

    await teable(`/table/${tableId}/record/${found.id}?fieldKeyType=name`, {
      method: 'PATCH',
      body: JSON.stringify({
        record: { fields: row },
        fieldKeyType: 'name',
        typecast: true,
      }),
    });
    updated += 1;
    console.log(`updated ${key}`);
  }

  console.log(JSON.stringify({ created, updated, skipped, tableUrl: seed.tableUrl }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
