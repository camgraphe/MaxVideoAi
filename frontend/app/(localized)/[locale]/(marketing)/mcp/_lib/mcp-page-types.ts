export type McpClientId = 'claude' | 'chatgpt' | 'codex';
export type McpCompatibilityHostId = 'claudeDesktop' | 'claudeCode' | 'chatgptWeb' | 'codexCli';
export type McpFeaturedAnswerId = 'identity' | 'selection' | 'safety';
export type McpAnswerDetailId = 'references' | 'credits' | 'library' | 'disconnect';

export type McpClientActionCopy = {
  client: McpClientId;
  href: string;
  label: string;
  supportingLabel: string;
};

export type McpConnectActionsCopy = {
  endpointLabel: string;
  copyEndpoint: string;
  copied: string;
  copyError: string;
};

export type McpPageCopy = {
  meta: {
    title: string;
    description: string;
  };
  breadcrumb: {
    home: string;
    current: string;
  };
  hero: {
    eyebrows: {
      trial: string;
      budget: string;
      price: string;
    };
    title: string;
    intro: string;
    previewIntro: string;
    trialDisclosure: string;
    actions: McpClientActionCopy[];
    connectActions: McpConnectActionsCopy;
  };
  workflow: {
    ariaLabel: string;
    steps: [string, string, string];
  };
  budget: {
    eyebrow: string;
    title: string;
    intro: string;
    exampleLabel: string;
    examplePrompt: string;
    qualityLabel: string;
    qualityBody: string;
    valueLabel: string;
    valueBody: string;
    attemptsNote: string;
    priceReferencesLabel: string;
    priceReferencesBody: string;
    slotLabels: Record<'included_trial' | 'lowest_paid' | 'affordable_upgrade', string>;
    modelLinkLabel: string;
    emptyTitle: string;
    emptyBody: string;
  };
  evidence: {
    eyebrow: string;
    title: string;
    verifiedLabel: string;
  };
  references: {
    eyebrow: string;
    title: string;
    intro: string;
    planningBody: string;
    liveBody: string;
    gatedBody: string;
    steps: Array<{ title: string; body: string }>;
  };
  answers: {
    eyebrow: string;
    title: string;
    updatedLabel: string;
    repositoryLabel: string;
    repositoryHref: string;
    featured: Record<McpFeaturedAnswerId, { title: string; body: string }>;
    items: Record<McpAnswerDetailId, { title: string; liveBody: string; gatedBody: string }>;
  };
  trust: {
    definition: { eyebrow: string; title: string; body: string };
    availability: { title: string; liveBody: string; gatedBody: string };
    compatibility: {
      title: string;
      body: string;
      checkpointLabel: string;
      sourceLabel: string;
      statuses: Record<McpCompatibilityHostId, string>;
    };
    confirmation: {
      title: string;
      liveBody: string;
      gatedBody: string;
      steps: string[];
    };
    controls: { title: string; body: string; items: string[] };
    capabilities: { title: string; body: string; items: string[] };
    setup: { title: string; body: string };
    faq: { title: string; items: Array<{ question: string; answer: string }> };
    support: { label: string; href: string };
  };
};
