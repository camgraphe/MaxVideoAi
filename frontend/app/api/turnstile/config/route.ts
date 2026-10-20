import { getPublicTurnstileConfiguration } from '@/server/turnstile-widgets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public identities only. No validation, database, session or payment operation. */
export function GET() {
  const config = getPublicTurnstileConfiguration();
  return Response.json(config.configured
    ? { activeSiteKey: config.activeSiteKey, acceptedSiteKeys: config.widgets.map(widget => widget.siteKey) }
    : { error: 'captcha_configuration_unavailable' }, {
    status: config.configured ? 200 : 503,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
