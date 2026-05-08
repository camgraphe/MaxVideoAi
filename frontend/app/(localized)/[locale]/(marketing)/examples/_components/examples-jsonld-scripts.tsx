import { serializeJsonLd } from '../_lib/examples-route-utils';

type ExamplesJsonLdScriptsProps = {
  breadcrumbJsonLd: unknown;
  faqJsonLd: unknown;
  itemListJson: unknown;
};

export function ExamplesJsonLdScripts({
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJson,
}: ExamplesJsonLdScriptsProps) {
  return (
    <>
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      ) : null}
      {itemListJson ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJson) }}
        />
      ) : null}
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
      ) : null}
    </>
  );
}
