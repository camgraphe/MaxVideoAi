import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { parseStoredImageRenders } from '@/lib/image-renders';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { FEATURES } from '@/content/feature-flags';
import type { CharacterReferenceSelection, CharacterReferencesResponse } from '@/types/image-generation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CharacterJobRow = {
  job_id: string;
  created_at: string;
  prompt: string | null;
  engine_label: string | null;
  settings_snapshot: unknown;
  render_ids: unknown;
};

function json(body: CharacterReferencesResponse, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function parseCharacterSnapshot(snapshot: unknown): Pick<CharacterReferenceSelection, 'outputMode' | 'action' | 'prompt'> {
  if (!snapshot || typeof snapshot !== 'object') {
    return { outputMode: null, action: null, prompt: null };
  }

  const record = snapshot as Record<string, unknown>;
  if (record.surface !== 'character-builder') {
    return { outputMode: null, action: null, prompt: null };
  }
  const builder = record.builder && typeof record.builder === 'object' ? (record.builder as Record<string, unknown>) : null;

  return {
    outputMode:
      builder?.outputMode === 'character-sheet' || builder?.outputMode === 'portrait-reference'
        ? builder.outputMode
        : null,
    action:
      record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
        ? record.action
        : null,
    prompt: typeof record.prompt === 'string' && record.prompt.trim().length ? record.prompt.trim() : null,
  };
}

export async function GET(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) {
    return json({ ok: false, characters: [], error: 'TOOLS_DISABLED' }, { status: 404 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    if (VISITOR_WORKSPACE_ENABLED) {
      return json({ ok: true, characters: [] });
    }
    return json({ ok: false, characters: [], error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return json({ ok: false, characters: [], error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[character-references] schema init failed', error);
    return json({ ok: false, characters: [], error: 'Database unavailable' }, { status: 503 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '60')));

  try {
    const rows = await query<CharacterJobRow>(
      `SELECT job_id, created_at, prompt, engine_label, settings_snapshot, render_ids
       FROM app_jobs
       WHERE user_id = $1
         AND hidden IS NOT TRUE
         AND render_ids IS NOT NULL
         AND settings_snapshot->>'surface' = 'character-builder'
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, limit]
    );

    const characters = rows.flatMap<CharacterReferenceSelection>((row) => {
      const snapshot = parseCharacterSnapshot(row.settings_snapshot);
      const renders = parseStoredImageRenders(row.render_ids);
      return renders.entries.map((entry, index) => ({
        id: `${row.job_id}:character:${index + 1}`,
        jobId: row.job_id,
        imageUrl: entry.url,
        thumbUrl: entry.thumbUrl ?? entry.url,
        prompt: snapshot.prompt ?? row.prompt ?? null,
        createdAt: row.created_at,
        engineLabel: row.engine_label ?? null,
        outputMode: snapshot.outputMode,
        action: snapshot.action,
      }));
    });

    return json({ ok: true, characters });
  } catch (error) {
    console.error('[character-references] failed to load references', error);
    return json({ ok: false, characters: [], error: 'Failed to load character references.' }, { status: 500 });
  }
}
