import type { LumaDirectPayload } from './payload';
import type { LumaGeneration } from './response';

export class LumaDirectClientError extends Error {
  status: number | null;
  raw: unknown;

  constructor(message: string, options?: { status?: number | null; raw?: unknown }) {
    super(message);
    this.name = 'LumaDirectClientError';
    this.status = options?.status ?? null;
    this.raw = options?.raw;
  }
}

export type LumaDirectClient = {
  createGeneration(payload: LumaDirectPayload): Promise<LumaGeneration>;
  fetchGeneration(providerJobId: string): Promise<LumaGeneration>;
};

function getApiKey(): string {
  const apiKey = (process.env.LUMA_AGENTS_API_KEY ?? process.env.LUMA_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new LumaDirectClientError('LUMA_AGENTS_API_KEY is not configured.', {
      status: 401,
      raw: { code: 'LUMA_DIRECT_MISSING_API_KEY' },
    });
  }
  return apiKey;
}

function getBaseUrl(): string {
  return (process.env.LUMA_AGENTS_API_BASE_URL ?? 'https://agents.lumalabs.ai/v1').replace(/\/+$/, '');
}

export function resolveLumaDirectApiPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath.replace(/^\/v1(?=\/)/, '');
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestLuma(path: string, init?: RequestInit): Promise<LumaGeneration> {
  const response = await fetch(`${getBaseUrl()}${resolveLumaDirectApiPath(path)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new LumaDirectClientError(`Luma direct request failed with HTTP ${response.status}.`, {
      status: response.status,
      raw: body,
    });
  }
  if (!body || typeof body !== 'object') {
    throw new LumaDirectClientError('Luma direct response was not a JSON object.', {
      status: response.status,
      raw: body,
    });
  }
  return body as LumaGeneration;
}

export function getLumaDirectClient(): LumaDirectClient {
  return {
    createGeneration(payload) {
      return requestLuma(payload.createPath, {
        method: 'POST',
        body: JSON.stringify(payload.body),
      });
    },
    fetchGeneration(providerJobId) {
      return requestLuma(`/v1/generations/${encodeURIComponent(providerJobId)}`);
    },
  };
}
