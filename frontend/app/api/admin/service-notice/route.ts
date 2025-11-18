import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getServiceNoticeSetting, setServiceNoticeSetting } from '@/server/app-settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const setting = await getServiceNoticeSetting();
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
  const payload = (body && typeof body === 'object' ? body : {}) as {
    enabled?: unknown;
    message?: unknown;
  };
  const enabled = payload.enabled === true;
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (message.length > 500) {
    return NextResponse.json({ ok: false, error: 'Le message ne peut pas dépasser 500 caractères.' }, { status: 400 });
  }
  if (enabled && !message) {
    return NextResponse.json({ ok: false, error: 'Le message est requis pour activer la bannière.' }, { status: 400 });
  }
  try {
    await setServiceNoticeSetting(
      {
        enabled,
        message,
      },
      adminUserId
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/service-notice] failed to update', error);
    return NextResponse.json({ ok: false, error: 'Impossible de mettre à jour la bannière.' }, { status: 500 });
  }
}
