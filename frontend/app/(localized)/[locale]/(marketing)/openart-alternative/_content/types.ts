import type { OpenArtCriterion, OpenArtSourceId } from '../_lib/evidence';

type Card = { title: string; text: string };

export type OpenArtCopy = {
  meta: { title: string; description: string };
  hero: {
    title: string;
    lead: string;
    action: string;
    compare: string;
    note: string;
    imageAlt: string;
    imageCaption: string;
  };
  decision: {
    label: string;
    title: string;
    options: readonly [Card & { steps: readonly [string, string, string] }, Card & { steps: readonly [string, string, string] }];
  };
  matrix: { title: string; caption: string; criterion: string; note: string; sources: string };
  rows: Record<OpenArtCriterion, { label: string; max: string; openart: string }>;
  workflow: {
    label: string;
    title: string;
    text: string;
    steps: readonly [Card, Card, Card];
    studio: string;
    mcp: string;
  };
  budget: { title: string; intro: string; items: readonly [Card, Card, Card]; guide: string; calculator: string };
  closing: { title: string; text: string; action: string; guide: string };
  faq: { title: string; items: readonly { question: string; answer: string }[] };
  evidence: { title: string; date: string; note: string };
  sourceLabels: Record<OpenArtSourceId, string>;
};
