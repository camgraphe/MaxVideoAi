export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { CharacterBuilderRequest, CharacterBuilderResponse } from '@/types/character-builder';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { FEATURES } from '@/content/feature-flags';
import { CharacterBuilderError, runCharacterBuilder } from '@/server/tools/character-builder';
import { RESTRICTED_ACCOUNT_MESSAGE, getActiveAccountRestriction } from '@/server/fraud-cleanup';

export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'tools_disabled',
          message: 'Tools are currently disabled.',
        },
      } satisfies CharacterBuilderResponse,
      { status: 404 }
    );
  }

  let body: Partial<CharacterBuilderRequest> | null = null;

  try {
    body = (await req.json()) as Partial<CharacterBuilderRequest>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Payload must be valid JSON.',
        },
      } satisfies CharacterBuilderResponse,
      { status: 400 }
    );
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'auth_required',
          message: 'Authentication required.',
        },
      } satisfies CharacterBuilderResponse,
      { status: 401 }
    );
  }
  const restriction = await getActiveAccountRestriction(userId);
  if (restriction) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'account_restricted',
          message: RESTRICTED_ACCOUNT_MESSAGE,
        },
      } satisfies CharacterBuilderResponse,
      { status: 403 }
    );
  }

  try {
    const result = await runCharacterBuilder({
      ...(body ?? {}),
      userId,
    } as CharacterBuilderRequest & { userId: string });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof CharacterBuilderError ? error.status : 502;
    const code = error instanceof CharacterBuilderError ? error.code : 'character_builder_error';
    const detail = error instanceof CharacterBuilderError ? error.detail : undefined;
    const message = error instanceof Error ? error.message : 'Character builder request failed.';

    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
          detail,
        },
      } satisfies CharacterBuilderResponse,
      { status }
    );
  }
}
