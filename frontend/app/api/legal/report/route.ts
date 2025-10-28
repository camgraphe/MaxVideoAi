import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createLegalReport } from '@/server/legal-reports';

export const runtime = 'nodejs';

const MAX_ATTACHMENT_CHARS = 3_500_000;
const REASONS = new Set(['copyright', 'privacy', 'defamation', 'trademark', 'other']);

type ReportBody = {
  email?: string;
  url?: string;
  reason?: string;
  details?: string;
  attachmentName?: string | null;
  attachmentBase64?: string | null;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: ReportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().toLowerCase() : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const attachmentName = typeof body.attachmentName === 'string' ? body.attachmentName.trim() : undefined;
  const attachmentBase64 = typeof body.attachmentBase64 === 'string' ? body.attachmentBase64.trim() : undefined;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'A valid contact email is required.' }, { status: 400 });
  }

  if (!url || !isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: 'A valid URL is required.' }, { status: 400 });
  }

  if (!REASONS.has(reason)) {
    return NextResponse.json({ ok: false, error: 'Please choose a valid reason.' }, { status: 400 });
  }

  if (!details || details.length < 20) {
    return NextResponse.json({ ok: false, error: 'Please describe the issue (minimum 20 characters).' }, { status: 400 });
  }

  if (attachmentBase64 && attachmentBase64.length > MAX_ATTACHMENT_CHARS) {
    return NextResponse.json({ ok: false, error: 'Attachment is too large.' }, { status: 400 });
  }

  try {
    const { id } = await createLegalReport({
      email,
      url,
      reason,
      details,
      attachmentName: attachmentName ?? null,
      attachmentBase64: attachmentBase64 ?? null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('[legal-report] failed to store report', error);
    return NextResponse.json(
      { ok: false, error: 'Unable to store the report at this time.' },
      { status: 500 }
    );
  }
}
