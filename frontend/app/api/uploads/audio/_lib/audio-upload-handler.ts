import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { getFalEngineById } from '@/config/falEngines';
import {
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
  type MediaFieldConstraint,
} from '@/lib/media-field-constraints';
import type { Mode } from '@/types/engines';
import { detectMediaBufferDuration } from '@/server/media/detect-has-audio';
import {
  getMaxAudioUploadMB,
  MediaUploadError,
  storeAudioUpload,
} from '@/server/uploads/store-media-upload';

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
  const maxAudioMB = getMaxAudioUploadMB();
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
    if (size > maxAudioMB * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: maxAudioMB }, { status: 413 });
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

  try {
    const stored = await storeAudioUpload({
      userId,
      fileName: blob.name,
      declaredMime: mime,
      bytes: buffer,
      verifiedDurationSec: durationSec,
    });
    return NextResponse.json({
      ok: true,
      asset: {
        id: stored.legacyAssetId,
        url: stored.storageUrl,
        width: stored.width,
        height: stored.height,
        size: stored.sizeBytes,
        mime: stored.mimeType,
        name: blob.name,
        durationSec: stored.durationSec,
      },
    });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      if (error.code === 'UNSUPPORTED_TYPE') {
        return NextResponse.json({ ok: false, error: error.code }, { status: 415 });
      }
      if (error.code === 'EMPTY_FILE') {
        return NextResponse.json({ ok: false, error: error.code }, { status: 400 });
      }
      if (error.code === 'METADATA_UNVERIFIED') {
        return NextResponse.json({ ok: false, error: error.code }, { status: 422 });
      }
      if (error.code === 'UPLOAD_FAILED') {
        return NextResponse.json({ ok: false, error: error.code }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
