/**
 * Katteb — factual AI copywriting.
 */

import type { Env } from '../types';
import type { RetrieverResearchResult } from './retriever';

export interface KattebCopyResult {
  headline: string;
  body: string;
  cta?: string;
  raw?: unknown;
}

export async function generateFactualCopy(
  research: RetrieverResearchResult,
  promptTemplate: string,
  env: Env,
): Promise<KattebCopyResult> {
  try {
    const res = await fetch('https://api.katteb.com/v1/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.KATTEB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: promptTemplate,
        context: {
          url: research.url,
          title: research.title,
          summary: research.summary,
        },
      }),
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Katteb rate limited'), { status: 429 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Katteb error: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as {
      headline?: string;
      body?: string;
      text?: string;
      cta?: string;
    };

    return {
      headline: data.headline ?? 'Untitled',
      body: data.body ?? data.text ?? '',
      cta: data.cta,
      raw: data,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Katteb generation failed'), { cause: error });
  }
}
