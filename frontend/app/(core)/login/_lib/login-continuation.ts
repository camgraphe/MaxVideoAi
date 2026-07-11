import type { AuthCopy, Locale } from './login-copy';

export type LoginContinuationKind = 'billing' | 'video' | 'image' | 'audio' | 'library' | 'tool';

export type LoginContinuation = {
  kind: LoginContinuationKind;
  title: string;
  body: string;
};

type LoginContinuationOptions = {
  copy: AuthCopy['continuation'];
  locale: Locale;
  nextPath: string;
};

function applyAmount(template: string, amount: string): string {
  return template.replace(/\{amount\}/g, amount);
}

function formatUsdAmount(amountCents: number, locale: Locale): string {
  const localeTag = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}

function isRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function buildLoginContinuation({ copy, locale, nextPath }: LoginContinuationOptions): LoginContinuation | null {
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return null;

  const target = new URL(nextPath, 'https://maxvideoai.local');
  const pathname = target.pathname;

  if (isRoute(pathname, '/billing')) {
    const amount = Number(target.searchParams.get('amount'));
    const currency = target.searchParams.get('currency')?.toUpperCase();
    if (Number.isSafeInteger(amount) && amount >= 1000 && currency === 'USD') {
      const amountLabel = formatUsdAmount(amount, locale);
      return {
        kind: 'billing',
        title: applyAmount(copy.billing.title, amountLabel),
        body: applyAmount(copy.billing.body, amountLabel),
      };
    }
    return { kind: 'billing', ...copy.billingGeneric };
  }

  if (isRoute(pathname, '/app/image')) return { kind: 'image', ...copy.image };
  if (isRoute(pathname, '/app/audio')) return { kind: 'audio', ...copy.audio };
  if (isRoute(pathname, '/app/library')) return { kind: 'library', ...copy.library };
  if (isRoute(pathname, '/app/tools')) return { kind: 'tool', ...copy.tool };
  if (pathname === '/app') return { kind: 'video', ...copy.video };

  return null;
}
