import { findElevenVoice } from '@/lib/audio-eleven-voices';

/** Read-only stock samples. Never invokes synthesis or uses a paid ElevenLabs credential. */
export async function resolveElevenVoicePreview(voiceId: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!findElevenVoice(voiceId)) return null;
  const response = await fetcher('https://api.elevenlabs.io/v1/voices', {
    next: { revalidate: 900 }, signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('Voice samples are unavailable.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('voices' in data) || !Array.isArray(data.voices)) return null;
  const voice = data.voices.find((value: unknown) => value && typeof value === 'object' && 'voice_id' in value && value.voice_id === voiceId);
  if (!voice || typeof voice.preview_url !== 'string') return null;
  const url = new URL(voice.preview_url);
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const officialStorage = url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/eleven-public-prod/');
  const officialPreview = ['api.elevenlabs.io', 'api.us.elevenlabs.io', 'api.eu.elevenlabs.io'].includes(url.hostname)
    && url.pathname.startsWith(`/v1/voices/${voiceId}/previews/`);
  return officialStorage || officialPreview ? url.href : null;
}
