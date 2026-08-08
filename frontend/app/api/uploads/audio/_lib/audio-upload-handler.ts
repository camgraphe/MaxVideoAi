import { NextRequest, NextResponse } from 'next/server';
import { uploadFileBuffer, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { getFalEngineById } from '@/config/falEngines';
import {
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
  type MediaFieldConstraint,
} from '@/lib/media-field-constraints';
import type { Mode } from '@/types/engines';
import { detectMediaBufferDuration } from '@/server/media/detect-has-audio';

const MAX_AUDIO_MB = Number(process.env.ASSET_MAX_AUDIO_MB ?? '30');

function formText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function resolveUploadConstraint(form: FormData):
  | {
      ok: true;
      constraint: MediaFieldConstraint | null;
      minDurationSec: number | null;
      maxDurationSec: number | null;
    }
  | { ok: false } {
  const engineId = formText(form, 'engineId');
  const mode = formText(form, 'mode');
  const fieldId = formText(form, 'fieldId');
  if (!engineId && !mode && !fieldId) {
    return { ok: true, constraint: null, minDurationSec: null, maxDurationSec: null };
  }
  if (!engineId || !mode || !fieldId) return { ok: false };

  const engine = getFalEngineById(engineId)?.engine;
  if (!engine || !engine.modes.includes(mode as Mode)) return { ok: false };
  const field = [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ].find(
    (candidate) =>
      candidate.id === fieldId &&
      candidate.type === 'audio' &&
      (!candidate.modes?.length || candidate.modes.includes(mode as Mode))
  );
  if (!field) return { ok: false };
  return {
    ok: true,
    constraint: resolveEngineMediaFieldConstraint({ engine, field }),
    minDurationSec:
      typeof field.minDurationSec === 'number' && Number.isFinite(field.minDurationSec)
        ? field.minDurationSec
        : null,
    maxDurationSec:
      typeof field.maxDurationSec === 'number' && Number.isFinite(field.maxDurationSec)
        ? field.maxDurationSec
        : null,
  };
}

export async function handleAudioUpload(
  req: NextRequest,
  deps: {
    getRouteAuthContextFn?: (request: NextRequest) => Promise<{ userId: string | null }>;
  } = {}
) {
  const form = await req.formData();
  const blob = form.get('file');

  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const uploadConstraint = resolveUploadConstraint(form);
  if (!uploadConstraint.ok) {
    return NextResponse.json({ ok: false, error: 'INVALID_UPLOAD_CONTEXT' }, { status: 400 });
  }

  const mime = blob.type || 'application/octet-stream';
  const size = blob.size ?? 0;
  if (!mime.startsWith('audio/')) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }
  if (uploadConstraint.constraint) {
    const validation = validateMediaFileAgainstConstraint({
      name: blob.name,
      mimeType: mime,
      sizeBytes: size,
      constraint: uploadConstraint.constraint,
    });
    if (!validation.ok && validation.reason === 'size') {
      return NextResponse.json(
        { ok: false, error: 'FILE_TOO_LARGE', maxMB: validation.maxSizeMB },
        { status: 413 }
      );
    }
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
    }
  } else {
    if (Number.isFinite(MAX_AUDIO_MB) && MAX_AUDIO_MB > 0 && size > MAX_AUDIO_MB * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: MAX_AUDIO_MB }, { status: 413 });
    }
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }

  const { userId } = await (deps.getRouteAuthContextFn ?? getRouteAuthContext)(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const durationSec = await detectMediaBufferDuration(buffer, {
    fileName: blob.name,
    mimeType: mime,
  });
  const requiresTrustedDuration =
    uploadConstraint.minDurationSec !== null || uploadConstraint.maxDurationSec !== null;
  if (requiresTrustedDuration && durationSec === null) {
    return NextResponse.json(
      { ok: false, error: 'DURATION_UNVERIFIED' },
      { status: 422 }
    );
  }
  if (
    durationSec !== null &&
    ((uploadConstraint.minDurationSec !== null && durationSec < uploadConstraint.minDurationSec) ||
      (uploadConstraint.maxDurationSec !== null && durationSec > uploadConstraint.maxDurationSec))
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'DURATION_UNSUPPORTED',
        durationSec,
        minDurationSec: uploadConstraint.minDurationSec,
        maxDurationSec: uploadConstraint.maxDurationSec,
      },
      { status: 422 }
    );
  }

  let uploadResult;
  try {
    uploadResult = await uploadFileBuffer({
      data: buffer,
      mime,
      fileName: blob.name,
      userId,
      prefix: 'user-assets',
    });
  } catch (error) {
    console.error('[upload] failed to store audio', error);
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  try {
    const assetId = await recordUserAsset({
      userId,
      url: uploadResult.url,
      mime,
      width: null,
      height: null,
      size: buffer.length,
      source: 'upload',
      metadata: { originalName: blob.name, kind: 'audio', durationSec },
    });

    await ensureReusableAsset({
      userId,
      url: uploadResult.url,
      kind: 'audio',
      source: 'upload',
      mimeType: mime,
      sizeBytes: buffer.length,
      durationSec,
    }).catch((error) => {
      console.warn('[upload] failed to mirror audio into media_assets', error);
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: null,
        height: null,
        size: buffer.length,
        mime,
        name: blob.name,
        durationSec,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record audio asset', error);
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
