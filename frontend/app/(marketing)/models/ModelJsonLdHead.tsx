import { buildModelServiceJsonLd, buildModelFaqJsonLd, serializeJsonLd } from './model-jsonld';

type Props = {
  slug: string;
};

export function ModelJsonLdHead({ slug }: Props) {
  const serviceJsonLd = buildModelServiceJsonLd(slug);
  const faqJsonLd = buildModelFaqJsonLd(slug);

  if (!serviceJsonLd && !faqJsonLd) {
    return null;
  }

  return (
    <>
      {serviceJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
        />
      ) : null}
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
      ) : null}
    </>
  );
}
