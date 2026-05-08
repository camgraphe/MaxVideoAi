type ToolBreadcrumbCopy = {
  home: string;
  tools: string;
  current: string;
};

type ToolHowToStepCopy = {
  title: string;
  body: string;
};

export function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildToolBreadcrumbJsonLd({
  breadcrumb,
  canonicalUrl,
}: {
  breadcrumb: ToolBreadcrumbCopy;
  canonicalUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumb.home,
        item: 'https://maxvideoai.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumb.tools,
        item: 'https://maxvideoai.com/tools',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumb.current,
        item: canonicalUrl,
      },
    ],
  };
}

export function buildToolHowToJsonLd({
  canonicalUrl,
  description,
  name,
  steps,
}: {
  canonicalUrl: string;
  description: string;
  name: string;
  steps: readonly ToolHowToStepCopy[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  };
}
