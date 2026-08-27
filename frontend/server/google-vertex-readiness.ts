import { randomUUID } from 'node:crypto';

import { getFalEngineById } from '@/config/falEngines';
import {
  getGoogleVertexAccessToken,
  parseGoogleVertexServiceAccount,
  type GoogleVertexServiceAccount,
} from '@/server/video-providers/google-vertex-auth';
import { resolveGoogleVertexOmniLocation } from '@/server/video-providers/google-vertex-omni/location';
import { resolveGoogleVertexOmniModelRoute } from '@/server/video-providers/google-vertex-omni/model-map';
import { resolveGoogleVertexVeoModelRoute } from '@/server/video-providers/google-vertex-veo/model-map';

type ReadinessModelKind = 'image' | 'veo' | 'omni';

type ReadinessModel = {
  engineId: string;
  providerModel: string;
  kind: ReadinessModelKind;
};

type ReadinessModelResult = ReadinessModel & {
  ok: boolean;
  metadataStatus: number | null;
  submitStatus: number | null;
  pollStatus: number | null;
};

export type GoogleVertexReadinessResult = {
  ok: boolean;
  projectId: string;
  location: string;
  checks: {
    oauth: { ok: boolean };
    gcs: { upload: boolean; read: boolean; delete: boolean };
    models: ReadinessModelResult[];
  };
};

type GoogleVertexReadinessDependencies = {
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  getAccessTokenFn?: (serviceAccount: GoogleVertexServiceAccount) => Promise<string>;
  randomIdFn?: () => string;
};

const PROBE_BODY = 'maxvideoai-vertex-readiness-v1';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isExpectedProbeRejection(status: number, payload: unknown): boolean {
  if (status !== 400 && status !== 422) return false;
  const error = asRecord(asRecord(payload)?.error);
  const providerStatus = typeof error?.status === 'string' ? error.status.trim().toUpperCase() : '';
  const message = typeof error?.message === 'string' ? error.message.trim().toLowerCase() : '';
  return providerStatus === 'INVALID_ARGUMENT' && !message.includes('unsupported location');
}

function imageModel(engineId: string): ReadinessModel {
  const providerModel = getFalEngineById(engineId)?.engine.providerMeta?.modelSlug?.trim();
  if (!providerModel) throw new Error(`Missing Google Vertex image model mapping for ${engineId}.`);
  return { engineId, providerModel, kind: 'image' };
}

function readinessModels(): ReadinessModel[] {
  return [
    imageModel('nano-banana'),
    imageModel('nano-banana-lite'),
    imageModel('nano-banana-2'),
    imageModel('nano-banana-pro'),
    {
      engineId: 'veo-3-1-lite',
      providerModel: resolveGoogleVertexVeoModelRoute('veo-3-1-lite').providerModel,
      kind: 'veo',
    },
    {
      engineId: 'veo-3-1-fast',
      providerModel: resolveGoogleVertexVeoModelRoute('veo-3-1-fast').providerModel,
      kind: 'veo',
    },
    {
      engineId: 'veo-3-1',
      providerModel: resolveGoogleVertexVeoModelRoute('veo-3-1').providerModel,
      kind: 'veo',
    },
    {
      engineId: 'gemini-omni-flash',
      providerModel: resolveGoogleVertexOmniModelRoute('gemini-omni-flash').providerModel,
      kind: 'omni',
    },
  ];
}

function parseGcsPrefix(value: string | undefined): { bucket: string; prefix: string } {
  const match = (value ?? '').trim().match(/^gs:\/\/([^/]+)(?:\/(.*))?$/);
  if (!match) throw new Error('GOOGLE_VERTEX_INPUT_GCS_URI is invalid.');
  return {
    bucket: match[1],
    prefix: (match[2] ?? '').replace(/^\/+|\/+$/g, ''),
  };
}

async function probeGcs(params: {
  accessToken: string;
  gcsUri: string | undefined;
  fetchFn: typeof fetch;
  randomId: string;
}): Promise<{ upload: boolean; read: boolean; delete: boolean }> {
  const result = { upload: false, read: false, delete: false };
  const { bucket, prefix } = parseGcsPrefix(params.gcsUri);
  const objectName = [prefix, 'readiness', `${params.randomId}.txt`].filter(Boolean).join('/');
  const encodedBucket = encodeURIComponent(bucket);
  const encodedObject = encodeURIComponent(objectName);
  const authorization = `Bearer ${params.accessToken}`;
  let generation: string | null = null;

  try {
    const upload = await params.fetchFn(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodedBucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodedObject}`,
      {
        method: 'POST',
        headers: { authorization, 'content-type': 'text/plain; charset=utf-8' },
        body: PROBE_BODY,
      },
    );
    if (!upload.ok) return result;
    const uploadPayload = (await upload.json().catch(() => null)) as Record<string, unknown> | null;
    generation = typeof uploadPayload?.generation === 'string' ? uploadPayload.generation : null;
    result.upload = true;

    const generationQuery = generation ? `&generation=${encodeURIComponent(generation)}` : '';
    const read = await params.fetchFn(
      `https://storage.googleapis.com/storage/v1/b/${encodedBucket}/o/${encodedObject}?alt=media${generationQuery}`,
      { headers: { authorization } },
    );
    result.read = read.ok && (await read.text()) === PROBE_BODY;
    return result;
  } catch {
    return result;
  } finally {
    if (result.upload) {
      const generationQuery = generation ? `?generation=${encodeURIComponent(generation)}` : '';
      try {
        const deleted = await params.fetchFn(
          `https://storage.googleapis.com/storage/v1/b/${encodedBucket}/o/${encodedObject}${generationQuery}`,
          { method: 'DELETE', headers: { authorization } },
        );
        result.delete = deleted.ok;
      } catch {
        result.delete = false;
      }
    }
  }
}

async function probeModel(params: {
  accessToken: string;
  apiBaseUrl: string;
  projectId: string;
  location: string;
  omniLocation: string;
  model: ReadinessModel;
  fetchFn: typeof fetch;
}): Promise<ReadinessModelResult> {
  const base = params.apiBaseUrl.replace(/\/+$/, '');
  const authorization = `Bearer ${params.accessToken}`;
  const project = encodeURIComponent(params.projectId);
  const location = encodeURIComponent(params.location);
  const model = encodeURIComponent(params.model.providerModel);
  const modelEndpoint = `${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}`;
  const interactionsEndpoint = `${base}/v1beta1/projects/${project}/locations/${encodeURIComponent(
    params.omniLocation,
  )}/interactions`;
  const headers = {
    authorization,
    'content-type': 'application/json',
    'x-goog-user-project': params.projectId,
  };

  let metadataStatus: number | null = null;
  if (params.model.kind !== 'veo') {
    try {
      const metadata = await params.fetchFn(
        `${base}/v1/publishers/google/models/${model}?view=PUBLISHER_MODEL_VERSION_VIEW_BASIC`,
        { headers },
      );
      metadataStatus = metadata.status;
    } catch {
      metadataStatus = null;
    }
  }

  let submitStatus: number | null = null;
  let submitPayload: unknown = null;
  try {
    const submitUrl =
      params.model.kind === 'image'
        ? `${modelEndpoint}:generateContent`
        : params.model.kind === 'veo'
          ? `${modelEndpoint}:predictLongRunning`
          : interactionsEndpoint;
    const submit = await params.fetchFn(submitUrl, {
      method: 'POST',
      headers,
      body: '{}',
    });
    submitStatus = submit.status;
    submitPayload = await submit.json().catch(() => null);
  } catch {
    submitStatus = null;
  }

  const submitOk = submitStatus !== null && isExpectedProbeRejection(submitStatus, submitPayload);
  let pollStatus: number | null = null;
  if (submitOk && params.model.kind !== 'image') {
    try {
      const poll =
        params.model.kind === 'veo'
          ? await params.fetchFn(`${modelEndpoint}:fetchPredictOperation`, {
              method: 'POST',
              headers,
              body: '{}',
            })
          : await params.fetchFn(`${interactionsEndpoint}/maxvideoai-readiness-does-not-exist`, { headers });
      pollStatus = poll.status;
    } catch {
      pollStatus = null;
    }
  }

  const metadataOk = params.model.kind === 'veo' || metadataStatus === 200;
  const pollOk = params.model.kind === 'image' || pollStatus === 400 || pollStatus === 404 || pollStatus === 422;
  return {
    ...params.model,
    ok: metadataOk && submitOk && pollOk,
    metadataStatus,
    submitStatus,
    pollStatus,
  };
}

export async function runGoogleVertexReadinessProbe(
  dependencies: GoogleVertexReadinessDependencies = {},
): Promise<GoogleVertexReadinessResult> {
  const env = dependencies.env ?? process.env;
  const fetchFn = dependencies.fetchFn ?? fetch;
  const projectId = (env.GOOGLE_VERTEX_PROJECT_ID ?? '').trim();
  const location = (env.GOOGLE_VERTEX_LOCATION ?? 'global').trim() || 'global';
  const omniLocation = resolveGoogleVertexOmniLocation(env.GOOGLE_VERTEX_OMNI_LOCATION);
  const apiBaseUrl = (env.GOOGLE_VERTEX_API_BASE_URL ?? 'https://aiplatform.googleapis.com').trim();
  const emptyResult: GoogleVertexReadinessResult = {
    ok: false,
    projectId,
    location,
    checks: {
      oauth: { ok: false },
      gcs: { upload: false, read: false, delete: false },
      models: [],
    },
  };

  if (!projectId || !apiBaseUrl) return emptyResult;

  let serviceAccount: GoogleVertexServiceAccount;
  let accessToken: string;
  try {
    serviceAccount = parseGoogleVertexServiceAccount(env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON);
    if (serviceAccount.project_id && serviceAccount.project_id !== projectId) return emptyResult;
    accessToken = dependencies.getAccessTokenFn
      ? await dependencies.getAccessTokenFn(serviceAccount)
      : await getGoogleVertexAccessToken({ serviceAccount, fetchFn });
  } catch {
    return emptyResult;
  }

  const gcs = await probeGcs({
    accessToken,
    gcsUri: env.GOOGLE_VERTEX_INPUT_GCS_URI ?? env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI,
    fetchFn,
    randomId: (dependencies.randomIdFn ?? randomUUID)(),
  }).catch(() => ({ upload: false, read: false, delete: false }));
  const models = await Promise.all(
    readinessModels().map((model) =>
      probeModel({ accessToken, apiBaseUrl, projectId, location, omniLocation, model, fetchFn }),
    ),
  );
  const oauth = { ok: true };
  const ok = oauth.ok && gcs.upload && gcs.read && gcs.delete && models.every((model) => model.ok);
  return {
    ok,
    projectId,
    location,
    checks: { oauth, gcs, models },
  };
}
