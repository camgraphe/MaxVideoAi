'use client';
import { JsonLd } from './SeoJsonLd';

type FaqEntry = {
  q: string;
  a: string;
};

export default function FaqJsonLd({ qa }: { qa: FaqEntry[] }) {
  return (
    <JsonLd
      json={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: qa.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: a,
          },
        })),
      }}
    />
  );
}
