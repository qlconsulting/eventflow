/**
 * Retriever AI — cloud browser scraping for target page research.
 */

import type { Env } from '../types';

export interface RetrieverResearchResult {
  url: string;
  title?: string;
  summary: string;
  raw?: unknown;
}

export async function scrapeTargetUrl(
  targetUrl: string,
  env: Env,
): Promise<RetrieverResearchResult> {
  try {
    const res = await fetch('https://api.retriever.ai/v1/browse', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RETRIEVER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        extract: ['title', 'main_content', 'company_signals'],
      }),
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Retriever rate limited'), { status: 429 });
    }
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error('Retriever auth failed'), { status: 401 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Retriever error: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as {
      title?: string;
      summary?: string;
      content?: string;
    };

    return {
      url: targetUrl,
      title: data.title,
      summary: data.summary ?? data.content ?? '',
      raw: data,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Retriever scrape failed'), { cause: error });
  }
}
