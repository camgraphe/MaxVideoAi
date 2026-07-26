export function buildModelPrelaunchSchemaPayloads({
  canonicalUrl,
  description,
  inLanguage,
  modelName,
  homeLabel,
  homeUrl,
  modelsLabel,
  modelsUrl,
}: {
  canonicalUrl: string;
  description: string;
  inLanguage: string;
  modelName: string;
  homeLabel: string;
  homeUrl: string;
  modelsLabel: string;
  modelsUrl: string;
}) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: modelName,
      description,
      inLanguage,
      isPartOf: {
        '@type': 'WebSite',
        name: 'MaxVideoAI',
        url: 'https://maxvideoai.com/',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: homeLabel,
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: modelsLabel,
          item: modelsUrl,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: modelName,
          item: canonicalUrl,
        },
      ],
    },
  ];
}
