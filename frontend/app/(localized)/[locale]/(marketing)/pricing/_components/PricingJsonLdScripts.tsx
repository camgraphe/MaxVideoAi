type PricingJsonLdScriptsProps = {
  breadcrumbJsonLd: object;
  serviceSchema: object;
};

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export function PricingJsonLdScripts({ breadcrumbJsonLd, serviceSchema }: PricingJsonLdScriptsProps) {
  return (
    <>
      <script
        id="pricing-breadcrumb-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        id="pricing-service-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }}
      />
    </>
  );
}
