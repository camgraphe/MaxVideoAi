export type ComparePageCopy = {
  meta?: {
    title?: string;
    description?: string;
    titleFallback?: string;
    descriptionFallback?: string;
    slugOverrides?: Record<string, { title?: string; description?: string }>;
  };
  hero?: {
    back?: string;
    kicker?: string;
    intro?: string;
    introPrelaunch?: string;
    takeawaysTitle?: string;
    lastUpdatedLabel?: string;
  };
  scorecard?: {
    title?: string;
    subtitle?: string;
    provisionalNote?: string;
    strengthsLabel?: string;
    winnerSummary?: string;
    winnerSummaryPrelaunch?: string;
    generateWith?: string;
    fullProfile?: string;
  };
  labels?: {
    pending?: string;
    supported?: string;
    notSupported?: string;
    na?: string;
    prompt?: string;
    tryPrompt?: string;
    tryPromptPrelaunch?: string;
    opensGenerator?: string;
    opensGeneratorPrelaunch?: string;
    savePromptForLaunch?: string;
    whatTests?: string;
    placeholder?: string;
    copyPrompt?: string;
    copied?: string;
    expandPrompt?: string;
    collapsePrompt?: string;
  };
  keySpecs?: { title?: string; subtitle?: string; keyLabel?: string };
  specLabels?: Record<string, string>;
  showdown?: { title?: string; subtitle?: string; subtitlePrelaunch?: string; note?: string; footer?: string };
  related?: { title?: string; subtitle?: string };
  prelaunch?: { title?: string; notice?: string };
  faq?: {
    title?: string;
    subtitle?: string;
    validating?: string;
    pricingDiff?: string;
    capabilityDiff?: string;
    capabilityPending?: string;
    outputDiff?: string;
    outputPending?: string;
    capabilityLabel?: string;
    outputLabel?: string;
    q1?: string;
    a1?: string;
    q2?: string;
    a2?: string;
    q3?: string;
    a3?: string;
    q4?: string;
    a4?: string;
    q5?: string;
    a5?: string;
    q6?: string;
    a6?: string;
    q7?: string;
    a7?: string;
    q8?: string;
    a8?: string;
    q9?: string;
    a9?: string;
    q10?: string;
    a10?: string;
    q11?: string;
    a11?: string;
  };
  summary?: {
    scorecardLabel?: string;
    scorecardLabelPrelaunch?: string;
    pricingLabel?: string;
    durationLabel?: string;
    scorecardTemplate?: string;
    scorecardTemplatePrelaunch?: string;
    pricingTemplate?: string;
    durationTemplate?: string;
    specTemplate?: string;
    resolutionTemplate?: string;
    bestLabel?: string;
  };
  metrics?: Record<string, { label?: string; tooltip?: string }>;
  breadcrumb?: { root?: string };
};

export type CompareDetailLabels = {
  pending: string;
  supported: string;
  notSupported: string;
  na: string;
  prompt: string;
  tryPrompt: string;
  tryPromptPrelaunch: string;
  opensGenerator: string;
  opensGeneratorPrelaunch: string;
  savePromptForLaunch: string;
  whatTests: string;
  placeholder: string;
  expandPrompt: string;
  collapsePrompt: string;
};

export function buildCompareDetailLabels(compareCopy: ComparePageCopy): CompareDetailLabels {
  return {
    pending: compareCopy.labels?.pending ?? 'Data pending',
    supported: compareCopy.labels?.supported ?? 'Supported',
    notSupported: compareCopy.labels?.notSupported ?? 'Not supported',
    na: compareCopy.labels?.na ?? 'N/A',
    prompt: compareCopy.labels?.prompt ?? 'Prompt',
    tryPrompt: compareCopy.labels?.tryPrompt ?? 'Try this prompt:',
    tryPromptPrelaunch: compareCopy.labels?.tryPromptPrelaunch ?? 'Prompt actions:',
    opensGenerator: compareCopy.labels?.opensGenerator ?? 'Opens the generator pre-filled.',
    opensGeneratorPrelaunch:
      compareCopy.labels?.opensGeneratorPrelaunch ??
      'Use these prompt links for planning; pre-launch engines unlock at launch.',
    savePromptForLaunch: compareCopy.labels?.savePromptForLaunch ?? 'Save this prompt for launch',
    whatTests: compareCopy.labels?.whatTests ?? 'What it tests',
    placeholder: compareCopy.labels?.placeholder ?? '',
    expandPrompt: compareCopy.labels?.expandPrompt ?? 'Show full prompt',
    collapsePrompt: compareCopy.labels?.collapsePrompt ?? 'Hide full prompt',
  };
}
