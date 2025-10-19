import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureEmailSchema } from '@/lib/schema';
import { postSlackMessage } from '@/server/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'postmark' | 'resend' | 'unknown';

type ParsedEvent = {
  provider: Provider;
  eventType: string;
  recipient: string | null;
  providerId: string | null;
  payload: Record<string, unknown>;
};

function normalizeRecipient(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length) {
    const first = value.find((entry) => typeof entry === 'string');
    return typeof first === 'string' ? first : null;
  }
  return null;
}

function parseEvent(raw: unknown): ParsedEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Record<string, unknown>;

  if (typeof payload.RecordType === 'string') {
    const recipient = normalizeRecipient(payload.Email ?? payload.Recipient);
    const providerId = typeof payload.MessageID === 'string' ? payload.MessageID : null;
    return {
      provider: 'postmark',
      eventType: payload.RecordType,
      recipient,
      providerId,
      payload,
    };
  }

  if (typeof payload.type === 'string') {
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const recipient = normalizeRecipient(data.to ?? data.recipient);
    const providerId = typeof data.email_id === 'string' ? data.email_id : typeof data.id === 'string' ? data.id : null;
    return {
      provider: 'resend',
      eventType: payload.type,
      recipient,
      providerId,
      payload,
    };
  }

  return {
    provider: 'unknown',
    eventType: typeof payload.type === 'string' ? payload.type : 'unknown',
    recipient: null,
    providerId: null,
    payload,
  };
}

const BOUNCE_EVENTS = new Set(['Bounce', 'SpamComplaint', 'email.bounced']);

function isProduction(): boolean {
  const vercel = (process.env.VERCEL_ENV ?? '').toLowerCase();
  if (vercel) return vercel === 'production';
  return process.env.NODE_ENV === 'production';
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, processed: 0, stored: 0, reason: 'database_not_configured' });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'invalid_json', detail: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const events: ParsedEvent[] = [];
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const parsed = parseEvent(entry);
      if (parsed) events.push(parsed);
    }
  } else {
    const parsed = parseEvent(payload);
    if (parsed) events.push(parsed);
  }

  if (!events.length) {
    return NextResponse.json({ ok: true, processed: 0, stored: 0 });
  }

  await ensureEmailSchema();

  let stored = 0;
  for (const event of events) {
    try {
      await query(
        `INSERT INTO email_events (provider, event_type, recipient, provider_id, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [event.provider, event.eventType, event.recipient, event.providerId, JSON.stringify(event.payload)]
      );
      stored += 1;
    } catch (error) {
      console.warn('[email-webhook] failed to store event', event.provider, event.eventType, error);
    }

    if (isProduction() && BOUNCE_EVENTS.has(event.eventType)) {
      void postSlackMessage(':mailbox_with_no_mail: Email event', {
        provider: event.provider,
        eventType: event.eventType,
        recipient: event.recipient,
        providerId: event.providerId,
      }).catch((error) => {
        console.warn('[email-webhook] failed to notify slack', error instanceof Error ? error.message : error);
      });
    }
  }

  return NextResponse.json({ ok: true, processed: events.length, stored });
}
