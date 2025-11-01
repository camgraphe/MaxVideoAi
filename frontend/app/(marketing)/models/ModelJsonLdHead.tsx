import { buildModelProductJsonLd, serializeJsonLd } from './model-jsonld';

type Props = {
  slug: string;
};

export function ModelJsonLdHead({ slug }: Props) {
  const jsonLd = buildModelProductJsonLd(slug);
  if (!jsonLd) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
    />
  );
}
