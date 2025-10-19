import { NextRequest, NextResponse } from 'next/server';
import { sendRenderCompletedEmail, sendWalletLowBalanceEmail, getLowBalanceThresholdCents } from '@/lib/email';
import { resolveSiteUrl } from '@/lib/email-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const adminKey = (process.env.CRON_SECRET ?? '').trim();
  if (!adminKey) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('x-admin-key') ?? req.headers.get('x-cron-key');
  return header === adminKey;
}

type TestEmailBody = {
  to?: string;
  template?: 'render' | 'wallet';
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: TestEmailBody = {};
  try {
    body = (await req.json()) as TestEmailBody;
  } catch {
    body = {};
  }

  const siteUrl = resolveSiteUrl();
  const template = body.template ?? 'render';
  const to = (body.to ?? process.env.EMAIL_FROM ?? 'delivery@mailtrap.io').trim();

  if (!to) {
    return NextResponse.json({ ok: false, error: 'recipient_missing' }, { status: 400 });
  }

  try {
    if (template === 'wallet') {
      const response = await sendWalletLowBalanceEmail({
        to,
        balanceCents: 1800,
        currency: 'USD',
        thresholdCents: getLowBalanceThresholdCents(),
        recipientName: 'MaxVideoAI Team',
      });
      return NextResponse.json({ ok: true, template, provider: response.provider, id: response.id });
    }

    const response = await sendRenderCompletedEmail({
      to,
      jobId: 'test-job-email',
      engineLabel: 'Fal 2.0',
      durationSec: 8,
      videoUrl: `${siteUrl}/app?job=test-email`,
      thumbnailUrl: 'https://www.maxvideo.ai/social/share.png',
      recipientName: 'MaxVideoAI Team',
    });
    return NextResponse.json({ ok: true, template: 'render', provider: response.provider, id: response.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: 'send_failed', detail: message }, { status: 500 });
  }
}
