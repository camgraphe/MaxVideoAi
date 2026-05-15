import { createHmac } from 'node:crypto';
import { ENV } from '@/lib/env';
import { KlingDirectError } from './errors';
import {
  normalizeKlingDirectElementTask,
  type KlingDirectElementCreatePayload,
  type NormalizedKlingDirectElementTask,
} from './elements';
import { firstString, normalizeKlingDirectTask, parseKlingJsonResponse } from './response';
import type { KlingDirectPayload } from './payload';
import type { NormalizedVideoProviderTask } from '../types';

const DEFAULT_TIMEOUT_MS = 45_000;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createKlingJwt(params: {
  accessKey: string;
  secretKey: string;
  nowSeconds?: number;
}): string {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iss: params.accessKey,
    exp: now + 1800,
    nbf: now - 5,
  });
  const signature = createHmac('sha256', params.secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function getKlingDirectConfig() {
  return {
    accessKey: ENV.KLING_ACCESS_KEY,
    secretKey: ENV.KLING_SECRET_KEY,
    baseUrl: trimTrailingSlash(ENV.KLING_API_BASE_URL ?? 'https://api-singapore.klingai.com'),
  };
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

export class KlingDirectClient {
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(params: {
    accessKey: string;
    secretKey: string;
    baseUrl: string;
    timeoutMs?: number;
  }) {
    this.accessKey = params.accessKey;
    this.secretKey = params.secretKey;
    this.baseUrl = trimTrailingSlash(params.baseUrl);
    this.timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private authHeader(): string {
    return `Bearer ${createKlingJwt({ accessKey: this.accessKey, secretKey: this.secretKey })}`;
  }

  async createTask(payload: KlingDirectPayload): Promise<NormalizedVideoProviderTask> {
    const response = await fetch(`${this.baseUrl}${payload.createPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
      },
      body: JSON.stringify(payload.body),
      cache: 'no-store',
      signal: timeoutSignal(this.timeoutMs),
    });
    const parsed = await parseKlingJsonResponse(response);
    const serviceCode = firstString(parsed, ['code']);
    if (!response.ok || (serviceCode && serviceCode !== '0')) {
      throw new KlingDirectError(firstString(parsed, ['message', 'msg']) ?? 'Kling direct submit failed.', {
        status: response.status,
        code: serviceCode,
        providerMessage: firstString(parsed, ['message', 'msg']),
        body: parsed,
      });
    }
    const task = normalizeKlingDirectTask(parsed);
    if (!task.providerJobId) {
      throw new KlingDirectError('Kling direct response did not include a task id.', {
        status: response.status,
        code: 'KLING_TASK_ID_MISSING',
        body: parsed,
      });
    }
    return task;
  }

  async createElement(payload: KlingDirectElementCreatePayload): Promise<NormalizedKlingDirectElementTask> {
    const response = await fetch(`${this.baseUrl}/v1/general/advanced-custom-elements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader(),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: timeoutSignal(this.timeoutMs),
    });
    const parsed = await parseKlingJsonResponse(response);
    const serviceCode = firstString(parsed, ['code']);
    if (!response.ok || (serviceCode && serviceCode !== '0')) {
      throw new KlingDirectError(firstString(parsed, ['message', 'msg']) ?? 'Kling element creation failed.', {
        status: response.status,
        code: serviceCode,
        providerMessage: firstString(parsed, ['message', 'msg']),
        body: parsed,
      });
    }
    const task = normalizeKlingDirectElementTask(parsed);
    if (!task.providerTaskId) {
      throw new KlingDirectError('Kling element response did not include a task id.', {
        status: response.status,
        code: 'KLING_TASK_ID_MISSING',
        body: parsed,
      });
    }
    return task;
  }

  async retrieveElement(params: { providerTaskId: string }): Promise<NormalizedKlingDirectElementTask> {
    const response = await fetch(
      `${this.baseUrl}/v1/general/advanced-custom-elements/${encodeURIComponent(params.providerTaskId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader(),
        },
        cache: 'no-store',
        signal: timeoutSignal(this.timeoutMs),
      }
    );
    const parsed = await parseKlingJsonResponse(response);
    const serviceCode = firstString(parsed, ['code']);
    if (!response.ok || (serviceCode && serviceCode !== '0')) {
      throw new KlingDirectError(firstString(parsed, ['message', 'msg']) ?? 'Kling element polling failed.', {
        status: response.status,
        code: serviceCode,
        providerMessage: firstString(parsed, ['message', 'msg']),
        body: parsed,
      });
    }
    const task = normalizeKlingDirectElementTask(parsed, params.providerTaskId);
    return task.providerTaskId ? task : { ...task, providerTaskId: params.providerTaskId };
  }

  async retrieveTask(params: {
    pollPathPrefix: string;
    providerJobId: string;
  }): Promise<NormalizedVideoProviderTask> {
    const response = await fetch(`${this.baseUrl}${params.pollPathPrefix}/${encodeURIComponent(params.providerJobId)}`, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader(),
      },
      cache: 'no-store',
      signal: timeoutSignal(this.timeoutMs),
    });
    const parsed = await parseKlingJsonResponse(response);
    const serviceCode = firstString(parsed, ['code']);
    if (!response.ok || (serviceCode && serviceCode !== '0')) {
      throw new KlingDirectError(firstString(parsed, ['message', 'msg']) ?? 'Kling direct poll failed.', {
        status: response.status,
        code: serviceCode,
        providerMessage: firstString(parsed, ['message', 'msg']),
        body: parsed,
      });
    }
    const task = normalizeKlingDirectTask(parsed, params.providerJobId);
    return task.providerJobId ? task : { ...task, providerJobId: params.providerJobId };
  }
}

export function getKlingDirectClient(): KlingDirectClient {
  const config = getKlingDirectConfig();
  const { accessKey, secretKey, baseUrl } = config;
  if (!accessKey || !secretKey) {
    throw new KlingDirectError('Kling direct API keys are not configured.', {
      code: 'KLING_CREDENTIALS_MISSING',
    });
  }
  return new KlingDirectClient({ accessKey, secretKey, baseUrl });
}
