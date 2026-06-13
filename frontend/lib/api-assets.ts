import { authFetch } from '@/lib/authFetch';

type SavedAsset = {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  mime?: string | null;
  size?: number | null;
};

export async function saveAssetToLibrary(payload: {
  url: string;
  jobId?: string | null;
  label?: string | null;
  source?: string | null;
  kind?: 'image' | 'video' | 'audio';
  sourceOutputId?: string | null;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  durationSec?: number | null;
}) {
  const response = await authFetch('/api/media-library/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: payload.url,
      jobId: payload.jobId ?? null,
      name: payload.label ?? null,
      label: payload.label ?? null,
      source: payload.source ?? null,
      kind: payload.kind ?? 'image',
      sourceOutputId: payload.sourceOutputId ?? null,
      thumbUrl: payload.thumbUrl ?? null,
      previewUrl: payload.previewUrl ?? null,
      durationSec: payload.durationSec ?? null,
    }),
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; asset?: SavedAsset } | null;
  if (!response.ok || !data?.ok || !data.asset) {
    throw new Error(
      data?.error ??
        `Failed to save ${payload.kind === 'video' ? 'video' : 'image'} (${response.status})`
    );
  }
  return data.asset;
}

export async function saveImageToLibrary(payload: {
  url: string;
  jobId?: string | null;
  label?: string | null;
  source?: string | null;
}) {
  return saveAssetToLibrary({
    ...payload,
    kind: 'image',
    source: payload.source ?? (payload.jobId ? 'generated' : null),
  });
}
