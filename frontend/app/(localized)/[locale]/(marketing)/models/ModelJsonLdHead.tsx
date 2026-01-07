import { buildModelServiceJsonLd, serializeJsonLd } from './model-jsonld';

type Props = {
  slug: string;
};

export function ModelJsonLdHead({ slug }: Props) {
  const serviceJsonLd = buildModelServiceJsonLd(slug);
  if (!serviceJsonLd) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
    />
  );
}
