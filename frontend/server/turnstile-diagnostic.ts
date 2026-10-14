import { evaluateWalletCheckoutGuard, resolveCheckoutClientIp } from '@/server/checkout-guard';
import { getPublicTurnstileConfiguration } from '@/server/turnstile-widgets';

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});

/** Authenticated callers only. This boundary deliberately has no payment dependencies. */
export async function handleTurnstileDiagnostic(request: Request, actorId: string): Promise<Response> {
  if (process.env.TURNSTILE_DIAGNOSTICS_ENABLED !== '1') return json({ error: 'not_found' }, 404);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'origin_rejected' }, 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'json_required' }, 415);
  }
  if (!getPublicTurnstileConfiguration().configured) return json({ error: 'captcha_configuration_error' }, 503);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'invalid_request' }, 400);
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); }
      chunks.push(chunk.value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['captchaToken', 'captchaSiteKey', 'mode'].includes(key)) ||
        typeof body.captchaToken !== 'string' || !body.captchaToken.trim() || body.captchaToken.length > 2048 ||
        (body.captchaSiteKey !== undefined && (typeof body.captchaSiteKey !== 'string' || !body.captchaSiteKey.trim() || body.captchaSiteKey.length > 256)) ||
        (body.mode !== undefined && !['hosted', 'express_checkout'].includes(body.mode))) {
      return json({ error: 'invalid_request' }, 400);
    }
    const result = await evaluateWalletCheckoutGuard({
      userId: actorId,
      clientIp: resolveCheckoutClientIp(request.headers),
      amountCents: 1700,
      mode: body.mode ?? 'hosted',
      // Always exercise the challenge path, independent of the administrator's purchase history.
      hasCompletedTopUp: false,
      isPresetTopupTier: false,
      captchaToken: body.captchaToken,
      captchaSiteKey: body.captchaSiteKey,
      metadata: { diagnostic: 'turnstile' },
    });
    // Return immediately: no session, customer, payment, receipt or wallet mutation.
    return json({ result }, result.action === 'allow' ? 200 : result.action === 'rate_limited' ? 429 : 403);
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'invalid_request' : 'diagnostic_unavailable' }, error instanceof SyntaxError ? 400 : 503);
  } finally {
    reader.releaseLock();
  }
}
