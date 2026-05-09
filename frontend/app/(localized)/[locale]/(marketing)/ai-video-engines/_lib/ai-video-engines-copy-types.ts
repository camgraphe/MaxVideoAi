import type { EnginesCatalog } from '../EnginesCatalog.client';
import type { ComparisonsDirectory } from '../ComparisonsDirectory.client';

export type HubFaqEntry = {
  question: string;
  answer: string;
};

export type HubCopy = {
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    compareNow: {
      left: string;
      right: string;
      compare: string;
      searchPlaceholder: string;
      noResults: string;
      strengthsLabel: string;
      strengthsFallback: string;
      modeLabels: Record<string, string>;
    };
  };
  sections: {
    popularTitle: string;
    popularIntro: string;
    useCasesTitle: string;
    useCasesIntro: string;
    enginesTitle: string;
    enginesIntro: string;
    enginesToggle: string;
    enginesToggleHintClosed: string;
    enginesToggleHintOpen: string;
    allComparisonsTitle: string;
    allComparisonsIntro: string;
    faqTitle: string;
    complianceLabel: string;
    quickStartLabel: string;
    prelaunchSpotlightLabel: string;
    prelaunchModelLabel: string;
    prelaunchCompareLabel: string;
    prelaunchCompareSecondaryLabel: string;
    useCasesFallback: string;
  };
  tagLabels: Record<string, string>;
  useCaseLabels: Record<string, string>;
  popularCompareLabel: string;
  catalogLabels: Parameters<typeof EnginesCatalog>[0]['labels'];
  listLabels: Parameters<typeof ComparisonsDirectory>[0]['labels'];
  faq: HubFaqEntry[];
};

export type BestForCtaCopy = {
  title: string;
  body: string;
  label: string;
};
