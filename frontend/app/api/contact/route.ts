import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { postSlackMessage } from '@/server/slack';
import { getDefaultFromAddress, getMailer } from '@/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  topic: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10).max(2000),
  locale: z.string().trim().max(12).optional(),
});

async function parseBody(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const raw = await req.json();
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  }
  const form = await req.formData();
  const entries: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string') {
      entries[key] = value;
    }
  });
  return entries;
}

function wantsJson(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  return accept.includes('application/json') || accept.includes('text/json');
}

function safeRedirectUrl(req: NextRequest, locale?: string | null, success = true): string {
  const defaultPath = locale ? `/${locale}/contact` : '/contact';
  const searchParam = success ? 'submitted=1' : 'error=1';
  // Prefer referer if it is same-origin and points to contact.
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      const pathMatches = /\/contact\/?$/i.test(url.pathname);
      if (url.origin === req.nextUrl.origin && pathMatches) {
        url.searchParams.set(success ? 'submitted' : 'error', '1');
        return url.toString();
      }
    } catch {
      // ignore malformed referer
    }
  }
  const url = new URL(defaultPath, req.nextUrl.origin);
  url.searchParams.set(success ? 'submitted' : 'error', '1');
  return url.toString();
}

export async function POST(req: NextRequest) {
  let parsed: Record<string, unknown>;
  try {
    parsed = await parseBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse request body';
    return wantsJson(req)
      ? NextResponse.json({ ok: false, error: 'invalid_body', detail: message }, { status: 400 })
      : NextResponse.redirect(safeRedirectUrl(req, null, false));
  }

  const result = contactSchema.safeParse(parsed);
  if (!result.success) {
    return wantsJson(req)
      ? NextResponse.json({ ok: false, error: 'invalid_input', detail: result.error.flatten() }, { status: 400 })
      : NextResponse.redirect(safeRedirectUrl(req, (parsed.locale as string) || null, false));
  }

  const { name, email, topic, message, locale } = result.data;

  const contactRecipient = (process.env.CONTACT_RECIPIENT_EMAIL ?? '').trim();
  const mailer = getMailer();
  if (!contactRecipient || !mailer) {
    const reason = !contactRecipient ? 'missing_contact_recipient' : 'mailer_not_configured';
    console.warn('[contact] unable to send email', {
      reason,
      contactRecipientPresent: Boolean(contactRecipient),
      mailerConfigured: Boolean(mailer),
    });
    return wantsJson(req)
      ? NextResponse.json({ ok: false, error: reason }, { status: 500 })
      : NextResponse.redirect(safeRedirectUrl(req, locale, false));
  }

  const from = getDefaultFromAddress() || 'no-reply@maxvideoai.com';
  const subject = 'New contact form message';
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Topic: ${topic || 'n/a'}`,
    `Locale: ${locale || 'unknown'}`,
    '',
    'Message:',
    message,
  ];

  try {
    await mailer.sendMail({
      to: contactRecipient,
      from,
      replyTo: email,
      subject,
      text: lines.join('\n'),
    });
  } catch (error) {
    console.warn('[contact] failed to send email', error instanceof Error ? error.message : error);
    return wantsJson(req)
      ? NextResponse.json({ ok: false, error: 'send_failed' }, { status: 500 })
      : NextResponse.redirect(safeRedirectUrl(req, locale, false));
  }

  // Slack is optional; failure should not block the form.
  void postSlackMessage('Contact form submission', {
    name,
    email,
    topic: topic || 'not specified',
    message,
    locale: locale || 'unknown',
    userAgent: req.headers.get('user-agent') || 'n/a',
  }).catch((error) => {
    console.warn('[contact] failed to post slack message', error instanceof Error ? error.message : error);
  });

  if (wantsJson(req)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(safeRedirectUrl(req, locale, true));
}
