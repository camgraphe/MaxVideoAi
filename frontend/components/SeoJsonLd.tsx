import { serializeJsonLd } from '@/lib/seo/jsonld';

export function JsonLd({ json }: { json: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(json) }}
    />
  );
}
