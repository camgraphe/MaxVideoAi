import { buildModelProductJsonLd, buildModelFaqJsonLd, serializeJsonLd } from './model-jsonld';

type Props = {
  slug: string;
};

export function ModelJsonLdHead({ slug }: Props) {
  const productJsonLd = buildModelProductJsonLd(slug);
  const faqJsonLd = buildModelFaqJsonLd(slug);

  if (!productJsonLd && !faqJsonLd) {
    return null;
  }

  return (
    <>
      {productJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
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
