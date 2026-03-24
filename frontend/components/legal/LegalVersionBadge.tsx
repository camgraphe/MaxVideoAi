import type { AppLocale } from '@/i18n/locales';
import type { LegalDocument, LegalDocumentKey } from '@/lib/legal';
import { formatLegalDate } from '@/lib/legal';

type LegalVersionBadgeProps = {
  docKey: LegalDocumentKey;
  doc: LegalDocument | null;
  locale?: AppLocale;
};

const BADGE_COPY: Record<AppLocale, { version: string; effective: string }> = {
  en: { version: 'Version', effective: 'Effective' },
  fr: { version: 'Version', effective: 'Applicable' },
  es: { version: 'Versión', effective: 'Vigente' },
};

export function LegalVersionBadge({ docKey, doc, locale = 'en' }: LegalVersionBadgeProps) {
  const version = doc?.version ?? 'draft';
  const publishedLabel = formatLegalDate(doc?.publishedAt, locale) ?? (doc?.version ?? null);
  const copy = BADGE_COPY[locale] ?? BADGE_COPY.en;

  return (
    <p
      className="mt-2 text-xs uppercase tracking-wide text-text-secondary"
      data-legal-key={docKey}
      data-legal-version={version}
      data-legal-published={publishedLabel ?? undefined}
    >
      <span className="font-semibold">{copy.version}:</span> {version}
      {publishedLabel ? <span aria-hidden="true"> • {copy.effective} {publishedLabel}</span> : null}
    </p>
  );
}
