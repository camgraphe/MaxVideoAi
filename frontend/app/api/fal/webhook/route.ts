import { NextResponse } from 'next/server';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';

export const dynamic = 'force-dynamic';

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  return /application\/json/i.test(contentType);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token');
  const expectedToken = process.env.FAL_WEBHOOK_TOKEN?.trim();

  if (expectedToken && tokenParam !== expectedToken) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type');
  const bodyText = await req.text();

  if (!bodyText) {
    return NextResponse.json({ ok: false, error: 'EMPTY_BODY' }, { status: 400 });
  }

  if (!isJsonContentType(contentType)) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' }, { status: 415 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch (error) {
    console.error('[fal-webhook] Failed to parse JSON', error);
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  try {
    await updateJobFromFalWebhook(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[fal-webhook] handler error', error);
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
