import { ENV } from '@/lib/env';

export function resolveSiteUrl(): string {
  const site = ENV.NEXT_PUBLIC_SITE_URL || ENV.SUPABASE_SITE_URL;
  if (site) {
    return site.endsWith('/') ? site.slice(0, -1) : site;
  }
  return 'https://maxvideoai.com';
}

export function withUtm(url: string, campaign: string): string {
  try {
    const normalized = new URL(url);
    normalized.searchParams.set('utm_source', 'email');
    normalized.searchParams.set('utm_medium', 'transactional');
    normalized.searchParams.set('utm_campaign', campaign);
    return normalized.toString();
  } catch {
    return url;
  }
}
