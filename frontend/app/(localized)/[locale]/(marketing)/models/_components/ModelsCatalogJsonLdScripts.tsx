type ModelsCatalogJsonLdScriptsProps = {
  breadcrumbJsonLd: unknown;
  faqJsonLd: unknown;
  itemListJsonLd: unknown;
};

function serializeJsonLd(jsonLd: unknown) {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

export function ModelsCatalogJsonLdScripts({
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
}: ModelsCatalogJsonLdScriptsProps) {
  return (
    <>
      <script
        id="models-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        id="models-itemlist-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
      <script
        id="models-faq-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
    </>
  );
}
