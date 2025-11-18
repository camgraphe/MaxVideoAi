import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getMailer, getDefaultFromAddress } from '@/server/mailer';

export const dynamic = 'force-dynamic';

async function runTest(to?: string) {
  const mailer = getMailer();
  const from = getDefaultFromAddress();
  if (!mailer || !from) {
    return NextResponse.json(
      { success: false, error: 'smtp_not_configured' },
      { status: 500 }
    );
  }
  const recipient = to?.trim() || from;
  try {
    await mailer.sendMail({
      to: recipient,
      from,
      subject: 'MaxVideoAI SMTP test',
      html: `<p>This is a test email sent at ${new Date().toISOString()}.</p>`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[email-test] failed to send test email', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'send_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const to =
    body && typeof body === 'object' && 'to' in body && typeof (body as { to?: unknown }).to === 'string'
      ? ((body as { to?: string }).to ?? undefined)
      : undefined;
  return runTest(to);
}

export async function GET() {
  return runTest();
}
