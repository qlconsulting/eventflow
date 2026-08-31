/**
 * Qolaba — visual generation & Eleven Labs audio assets.
 */

import type { Env } from '../types';
import type { KattebCopyResult } from './katteb';

export interface QolabaAssets {
  imageUrl?: string;
  audioUrl?: string;
  raw?: unknown;
}

export async function generateAssets(
  copy: KattebCopyResult,
  env: Env,
  options: { visuals?: boolean; audio?: boolean } = {},
): Promise<QolabaAssets> {
  const wantVisuals = options.visuals !== false;
  const wantAudio = options.audio === true;

  if (!wantVisuals && !wantAudio) {
    return {};
  }

  try {
    const res = await fetch('https://api.qolaba.com/v1/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.QOLABA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        headline: copy.headline,
        body: copy.body,
        generate_image: wantVisuals,
        generate_audio: wantAudio,
      }),
    });

    if (res.status === 429) {
      throw Object.assign(new Error('Qolaba rate limited'), { status: 429 });
    }
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Qolaba error: ${text}`), { status: res.status });
    }

    const data = (await res.json()) as {
      image_url?: string;
      audio_url?: string;
    };

    return {
      imageUrl: data.image_url,
      audioUrl: data.audio_url,
      raw: data,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Qolaba generation failed'), { cause: error });
  }
}
