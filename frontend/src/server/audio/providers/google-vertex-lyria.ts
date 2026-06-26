import { createSign } from 'node:crypto';
import {
  AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC,
  AUDIO_LYRIA3_CLIP_MODEL_ID,
  AUDIO_LYRIA3_PRO_MAX_DURATION_SEC,
  AUDIO_LYRIA3_PRO_MODEL_ID,
  type AudioIntensity,
  type AudioMood,
} from '@/lib/audio-generation';
import { buildMusicPrompt, limitProviderPrompt } from './prompts';
import type { AudioProviderResult } from './types';

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

type GoogleVertexLyriaConfig = {
  projectId: string;
  location: string;
  serviceAccount: GoogleServiceAccount;
  apiBaseUrl: string;
};

type GoogleVertexLyriaEnv = Record<string, string | undefined>;

type GoogleVertexLyriaDeps = {
  env?: GoogleVertexLyriaEnv;
  fetchFn?: typeof fetch;
  getAccessTokenFn?: (serviceAccount: GoogleServiceAccount) => Promise<string>;
};

export const GOOGLE_VERTEX_LYRIA3_PROVIDER_KEY = 'google_vertex_lyria3' as const;
export const GOOGLE_VERTEX_LYRIA3_PROVIDER_LABEL = 'Google Lyria 3' as const;

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function flagDisabled(value: string | undefined): boolean {
  return ['0', 'false', 'no', 'off'].includes((value ?? '').trim().toLowerCase());
}

export function isGoogleVertexLyria3Configured(env: GoogleVertexLyriaEnv = process.env): boolean {
  return (
    !flagDisabled(env.GOOGLE_VERTEX_LYRIA_ENABLED) &&
    Boolean(env.GOOGLE_VERTEX_PROJECT_ID?.trim()) &&
    Boolean(env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim())
  );
}

export function isGoogleVertexLyria3DurationSupported(durationSec: number): boolean {
  return Number.isFinite(durationSec) && durationSec > 0 && durationSec <= AUDIO_LYRIA3_PRO_MAX_DURATION_SEC;
}

export function selectGoogleVertexLyria3Model(durationSec: number): string {
  return durationSec <= AUDIO_LYRIA3_CLIP_MAX_DURATION_SEC
    ? AUDIO_LYRIA3_CLIP_MODEL_ID
    : AUDIO_LYRIA3_PRO_MODEL_ID;
}

function parseServiceAccount(raw: string | undefined): GoogleServiceAccount {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error('GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is missing.');
  }

  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Google service account JSON is missing client_email or private_key.');
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri,
    project_id: parsed.project_id,
  };
}

function getConfig(env: GoogleVertexLyriaEnv = process.env): GoogleVertexLyriaConfig {
  const projectId = (env.GOOGLE_VERTEX_PROJECT_ID ?? '').trim();
  if (!projectId) {
    throw new Error('GOOGLE_VERTEX_PROJECT_ID is missing.');
  }
  return {
    projectId,
    location: (env.GOOGLE_VERTEX_LYRIA_LOCATION ?? 'global').trim() || 'global',
    serviceAccount: parseServiceAccount(env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON),
    apiBaseUrl: (env.GOOGLE_VERTEX_LYRIA_API_BASE_URL ?? '').trim() || 'https://aiplatform.googleapis.com',
  };
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function buildJwt(serviceAccount: GoogleServiceAccount): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  return `${signingInput}.${base64Url(signature)}`;
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(serviceAccount),
    }),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = typeof json?.error === 'string' ? json.error : response.statusText;
    throw new Error(`Google OAuth token request failed (${response.status}): ${code}`);
  }
  const accessToken = typeof json?.access_token === 'string' ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new Error('Google OAuth response did not include an access token.');
  }
  cachedToken = { accessToken, expiresAtMs: Date.now() + expiresIn * 1000 };
  return accessToken;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractAudioDataUrl(raw: unknown): string | null {
  const record = asRecord(raw);
  const outputs = Array.isArray(record?.outputs) ? record.outputs : [];
  for (const output of outputs) {
    const item = asRecord(output);
    if (!item || item.type !== 'audio') continue;
    const data = typeof item.data === 'string' && item.data.trim() ? item.data.trim() : null;
    if (!data) continue;
    if (data.startsWith('data:audio/')) return data;
    const mime =
      (typeof item.mime_type === 'string' && item.mime_type.trim()) ||
      (typeof item.mimeType === 'string' && item.mimeType.trim()) ||
      'audio/mpeg';
    return `data:${mime};base64,${data}`;
  }
  return null;
}

function buildPrompt(input: {
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
  prompt?: string | null;
}) {
  const base = buildMusicPrompt(input.mood, input.intensity, input.prompt);
  return limitProviderPrompt(
    `${base} Instrumental only, no vocals, no lyrics, no speech. Clean cinematic mix. Target duration around ${input.durationSec} seconds.`
  );
}

export async function generateGoogleVertexLyria3Track(input: {
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
  prompt?: string | null;
}, deps: GoogleVertexLyriaDeps = {}): Promise<AudioProviderResult> {
  if (!isGoogleVertexLyria3DurationSupported(input.durationSec)) {
    throw new Error(`Google Vertex Lyria 3 supports music up to ${AUDIO_LYRIA3_PRO_MAX_DURATION_SEC}s.`);
  }

  const config = getConfig(deps.env);
  const model = selectGoogleVertexLyria3Model(input.durationSec);
  const endpoint = `${config.apiBaseUrl.replace(/\/+$/, '')}/v1beta1/projects/${encodeURIComponent(
    config.projectId
  )}/locations/${encodeURIComponent(config.location)}/interactions`;
  const fetchFn = deps.fetchFn ?? fetch;
  const accessToken = await (deps.getAccessTokenFn ?? getAccessToken)(config.serviceAccount);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000);

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            type: 'text',
            text: buildPrompt(input),
          },
        ],
      }),
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const error = asRecord(asRecord(json)?.error);
      const code = typeof error?.status === 'string' ? error.status : response.statusText;
      throw new Error(`Google Vertex Lyria request failed (${response.status}): ${code}`);
    }
    const audioUrl = extractAudioDataUrl(json);
    if (!audioUrl) {
      throw new Error('Google Vertex Lyria response did not include audio output.');
    }
    const responseRecord = asRecord(json);
    return {
      url: audioUrl,
      providerKey: GOOGLE_VERTEX_LYRIA3_PROVIDER_KEY,
      providerLabel: GOOGLE_VERTEX_LYRIA3_PROVIDER_LABEL,
      model: typeof responseRecord?.model === 'string' ? responseRecord.model : model,
      requestId: typeof responseRecord?.id === 'string' ? responseRecord.id : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Google Vertex Lyria request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
