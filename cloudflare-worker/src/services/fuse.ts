/**
 * Fuse — outbound workflows & campaign syncing.
 */

import type { Env } from '../types';
import type { KattebCopyResult } from './katteb';

export interface FuseSyncResult {
  campaignId: string;
  raw?: unknown;
}

export async function syncOutboundCampaign(
  copy: KattebCopyResult,
  targetUrl: string,
  env: Env,
): Promise<FuseSyncResult> {
  try {
    const res = await fetch('https://api.fuse.so/v1/campaigns', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FUSE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: copy.headline,
        body: copy.body,
        cta: copy.cta,
        source_url: targetUrl,
      }),
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Fuse rate limited'), { status: 429 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Fuse error: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as { id?: string; campaign_id?: string };
    const campaignId = data.id ?? data.campaign_id;
    if (!campaignId) {
      throw new Error('Fuse response missing campaign id');
    }

    return { campaignId, raw: data };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Fuse sync failed'), { cause: error });
  }
}
