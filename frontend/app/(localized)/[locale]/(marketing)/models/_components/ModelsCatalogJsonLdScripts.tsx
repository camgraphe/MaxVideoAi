import Script from 'next/script';

type ModelsCatalogJsonLdScriptsProps = {
  breadcrumbJsonLd: unknown;
  faqJsonLd: unknown;
  itemListJsonLd: unknown;
};

export function ModelsCatalogJsonLdScripts({
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
}: ModelsCatalogJsonLdScriptsProps) {
  return (
    <>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id="models-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListJsonLd)}
      </Script>
      <Script id="models-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqJsonLd)}
      </Script>
    </>
  );
}
