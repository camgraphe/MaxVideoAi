type MarketingServiceOffer = {
  availability?: string;
  description?: string;
  price: string;
  priceCurrency: string;
  url?: string;
};

type BuildMarketingServiceJsonLdInput = {
  category?: string;
  description: string;
  name: string;
  offers?: MarketingServiceOffer;
  serviceType: string;
  url: string;
};

const MAXVIDEOAI_ORGANIZATION = {
  '@type': 'Organization',
  name: 'MaxVideoAI',
  url: 'https://maxvideoai.com',
  logo: 'https://maxvideoai.com/favicon-512.png',
} as const;

export function buildMarketingServiceJsonLd({
  category,
  description,
  name,
  offers,
  serviceType,
  url,
}: BuildMarketingServiceJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    serviceType,
    category,
    areaServed: 'Worldwide',
    provider: MAXVIDEOAI_ORGANIZATION,
    offers: offers
      ? {
          '@type': 'Offer',
          price: offers.price,
          priceCurrency: offers.priceCurrency,
          availability: offers.availability,
          description: offers.description,
          url: offers.url ?? url,
        }
      : undefined,
  };
}
