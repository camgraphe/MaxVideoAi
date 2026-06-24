import {
  AudioLines,
  Clapperboard,
  Mic2,
  Music2,
  type LucideIcon,
} from 'lucide-react';

import { authFetch } from '@/lib/authFetch';
import type {
  AudioIntensity,
  AudioLanguage,
  AudioMood,
  AudioOutputKind,
  AudioPackId,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';
import { uploadVideoFile } from '@/lib/client-video-upload';
import type { AudioWorkspaceCopy } from '../copy';
import type { AudioJobDetail } from './audio-workspace-types';

export const DEFAULT_PACK: AudioPackId = 'cinematic';
export const DEFAULT_MOOD: AudioMood = 'epic';
export const DEFAULT_INTENSITY: AudioIntensity = 'standard';
export const DEFAULT_VOICE_GENDER: AudioVoiceGender = 'female';
export const DEFAULT_VOICE_PROFILE: AudioVoiceProfile = 'balanced';
export const DEFAULT_VOICE_DELIVERY: AudioVoiceDelivery = 'cinematic';
export const DEFAULT_LANGUAGE: AudioLanguage = 'auto';
export const DEFAULT_MANUAL_DURATION_SEC = 8;
export const AUDIO_VOICE_GENDER_VALUES = ['female', 'male', 'neutral'] as const;

export const AUDIO_MODE_META: Record<
  AudioPackId,
  {
    icon: LucideIcon;
    providerKey: keyof AudioWorkspaceCopy['controls']['providers'];
  }
> = {
  music_only: {
    icon: Music2,
    providerKey: 'music',
  },
  voice_only: {
    icon: Mic2,
    providerKey: 'voice',
  },
  sfx_only: {
    icon: AudioLines,
    providerKey: 'sfx',
  },
  cinematic: {
    icon: Clapperboard,
    providerKey: 'sfx',
  },
  cinematic_voice: {
    icon: AudioLines,
    providerKey: 'mix',
  },
};

export function resolveProviderLabel(copy: AudioWorkspaceCopy, pack: AudioPackId): string {
  return copy.controls.providers[AUDIO_MODE_META[pack].providerKey];
}

export function formatDateTime(value: string, locale?: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((resolved, [key, value]) => {
    return resolved.split(`{${key}}`).join(String(value));
  }, template);
}

export function formatCurrency(amountCents?: number | null, currency = 'USD', locale?: string): string {
  if (typeof amountCents !== 'number') return '-';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function resolveUiErrorMessage(
  error: unknown,
  fallback: string,
  genericMessages: string[] = []
): string {
  if (!(error instanceof Error) || !error.message.trim().length) {
    return fallback;
  }
  return genericMessages.includes(error.message) ? fallback : error.message;
}

export function inferOutputKind(detail: {
  outputKind?: AudioOutputKind | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
}): AudioOutputKind {
  if (detail.outputKind) return detail.outputKind;
  if (detail.videoUrl && detail.audioUrl) return 'both';
  if (detail.audioUrl) return 'audio';
  return 'video';
}

export async function probeVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    const finish = (value: number | null) => {
      cleanup();
      resolve(value);
    };

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export async function uploadAsset(file: File, kind: 'video' | 'audio'): Promise<{ url: string; name: string }> {
  if (kind === 'video') {
    const uploaded = await uploadVideoFile(file);
    return {
      url: uploaded.url,
      name: uploaded.name ?? file.name,
    };
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await authFetch('/api/uploads/audio', {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; asset?: { url?: string; name?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? 'Upload failed');
  }
  return {
    url: payload.asset.url,
    name: payload.asset.name ?? file.name,
  };
}

export async function fetchJobDetail(jobId: string): Promise<AudioJobDetail> {
  const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  const payload = (await response.json().catch(() => null)) as AudioJobDetail | null;
  if (!response.ok || !payload?.jobId) {
    throw new Error(payload?.error ?? 'Unable to load job.');
  }
  return payload;
}
