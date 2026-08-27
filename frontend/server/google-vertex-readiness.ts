import { randomUUID } from 'node:crypto';

import { getFalEngineById } from '@/config/falEngines';
import {
  getGoogleVertexAccessToken,
  parseGoogleVertexServiceAccount,
  type GoogleVertexServiceAccount,
} from '@/server/video-providers/google-vertex-auth';
import { resolveGoogleVertexOmniModelRoute } from '@/server/video-providers/google-vertex-omni/model-map';
import { resolveGoogleVertexVeoModelRoute } from '@/server/video-providers/google-vertex-veo/model-map';

type ReadinessModel = {
  engineId: string;
  providerModel: string;
};

type ReadinessModelResult = ReadinessModel & {
  ok: boolean;
  status: number | null;
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

function imageModel(engineId: string): ReadinessModel {
  const providerModel = getFalEngineById(engineId)?.engine.providerMeta?.modelSlug?.trim();
  if (!providerModel) throw new Error(`Missing Google Vertex image model mapping for ${engineId}.`);
  return { engineId, providerModel };
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
    },
    {
      engineId: 'veo-3-1-fast',
      providerModel: resolveGoogleVertexVeoModelRoute('veo-3-1-fast').providerModel,
    },
    {
      engineId: 'veo-3-1',
      providerModel: resolveGoogleVertexVeoModelRoute('veo-3-1').providerModel,
    },
    {
      engineId: 'gemini-omni-flash',
      providerModel: resolveGoogleVertexOmniModelRoute('gemini-omni-flash').providerModel,
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
  model: ReadinessModel;
  fetchFn: typeof fetch;
}): Promise<ReadinessModelResult> {
  const base = params.apiBaseUrl.replace(/\/+$/, '');
  const resource = `projects/${encodeURIComponent(params.projectId)}/locations/${encodeURIComponent(
    params.location,
  )}/publishers/google/models/${encodeURIComponent(params.model.providerModel)}`;
  try {
    const response = await params.fetchFn(`${base}/v1beta1/${resource}:getIamPolicy`, {
      method: 'POST',
      headers: { authorization: `Bearer ${params.accessToken}` },
    });
    return { ...params.model, ok: response.ok, status: response.status };
  } catch {
    return { ...params.model, ok: false, status: null };
  }
}

export async function runGoogleVertexReadinessProbe(
  dependencies: GoogleVertexReadinessDependencies = {},
): Promise<GoogleVertexReadinessResult> {
  const env = dependencies.env ?? process.env;
  const fetchFn = dependencies.fetchFn ?? fetch;
  const projectId = (env.GOOGLE_VERTEX_PROJECT_ID ?? '').trim();
  const location = (env.GOOGLE_VERTEX_LOCATION ?? 'global').trim() || 'global';
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
      probeModel({ accessToken, apiBaseUrl, projectId, location, model, fetchFn }),
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
