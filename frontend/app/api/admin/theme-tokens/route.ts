import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getThemeTokensSetting, setThemeTokensSetting } from '@/server/app-settings';
import { EMPTY_THEME_TOKENS, normalizeThemeTokens, validateThemeTokens } from '@/lib/theme-tokens';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const setting = await getThemeTokensSetting();
  return NextResponse.json(setting);
}

export async function PUT(req: NextRequest) {
  const adminUserId = await requireAdmin(req);
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const payload = normalizeThemeTokens(body);
  const errors = validateThemeTokens(payload);
  if (errors.length) {
    const summary = errors
      .slice(0, 8)
      .map((entry) => `--${entry.key} (${entry.mode})`)
      .join(', ');
    return NextResponse.json(
      {
        ok: false,
        error: `Valeurs invalides: ${summary}`,
        details: errors,
      },
      { status: 400 }
    );
  }
  try {
    await setThemeTokensSetting(payload, adminUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/theme-tokens] failed to update', error);
    return NextResponse.json({ ok: false, error: 'Impossible de sauvegarder le theme.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminUserId = await requireAdmin(req);
  try {
    await setThemeTokensSetting(EMPTY_THEME_TOKENS, adminUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/theme-tokens] failed to reset', error);
    return NextResponse.json({ ok: false, error: 'Impossible de reinitialiser le theme.' }, { status: 500 });
  }
}
