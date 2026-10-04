export function getFalWebhookUrl(): string | null {
  const token = process.env.FAL_WEBHOOK_TOKEN?.trim();
  const deploymentBypass = process.env.FAL_WEBHOOK_VERCEL_BYPASS_SECRET?.trim();
  if (deploymentBypass && !token) {
    throw new Error('FAL_WEBHOOK_TOKEN_REQUIRED_FOR_PROTECTED_CALLBACK');
  }
  const candidates: Array<{ value: string | undefined | null; normalize?: (raw: string) => string }> = [
    { value: process.env.FAL_WEBHOOK_BASE_URL },
    { value: process.env.NEXT_PUBLIC_APP_URL },
    { value: process.env.APP_URL },
    { value: process.env.APP_BASE_URL },
    { value: process.env.NEXT_PUBLIC_SITE_URL },
    {
      value: process.env.VERCEL_URL,
      normalize: (raw) => (raw.startsWith('http') ? raw : `https://${raw}`),
    },
    {
      value: process.env.NEXT_PUBLIC_VERCEL_URL,
      normalize: (raw) => (raw.startsWith('http') ? raw : `https://${raw}`),
    },
  ];

  for (const candidate of candidates) {
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!raw) continue;
    const normalized = candidate.normalize ? candidate.normalize(raw) : raw;
    if (!/^https?:\/\//i.test(normalized)) continue;
    const base = normalized.replace(/\/+$/, '') + '/';
    const webhookUrl = new URL('api/fal/webhook', base);
    if (deploymentBypass && webhookUrl.protocol !== 'https:') {
      throw new Error('FAL_WEBHOOK_HTTPS_REQUIRED_FOR_PROTECTED_CALLBACK');
    }
    if (token) {
      webhookUrl.searchParams.set('token', token);
    }
    if (deploymentBypass) {
      webhookUrl.searchParams.set('x-vercel-protection-bypass', deploymentBypass);
    }
    return webhookUrl.toString();
  }

  return null;
}
