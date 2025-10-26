import type { LegalDocument, LegalDocumentKey } from '@/lib/legal';
import { formatLegalDate } from '@/lib/legal';

type LegalVersionBadgeProps = {
  docKey: LegalDocumentKey;
  doc: LegalDocument | null;
};

export function LegalVersionBadge({ docKey, doc }: LegalVersionBadgeProps) {
  const version = doc?.version ?? 'draft';
  const publishedLabel = formatLegalDate(doc?.publishedAt) ?? (doc?.version ?? null);

  return (
    <p
      className="mt-2 text-xs uppercase tracking-wide text-text-secondary"
      data-legal-key={docKey}
      data-legal-version={version}
      data-legal-published={publishedLabel ?? undefined}
    >
      <span className="font-semibold">Version:</span> {version}
      {publishedLabel ? <span aria-hidden="true"> • Effective {publishedLabel}</span> : null}
    </p>
  );
}
