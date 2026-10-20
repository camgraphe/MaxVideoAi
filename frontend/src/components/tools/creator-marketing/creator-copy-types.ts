import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
export type CreatorMarketingCopy = {
  name: string; title: string; description: string; intro: string;
  input: string; adjustment: string; output: string;
  steps: [string, string, string]; limits: string[];
  questions: Array<{ question: string; answer: string }>;
};
export type CreatorMarketingDictionary = Record<CreatorToolId, CreatorMarketingCopy>;
export type CreatorMarketingLabels = {
  home: string; tools: string; eyebrow: string; open: string; how: string;
  inputs: string; settings: string; result: string; workflow: string; limits: string; faq: string;
  quoteTitle: string; quoteBody: string; related: string; illustration: string; preview: string;
  demo: string; photo: string; video: string; voice: string; character: string; performance: string;
  source: string; after: string; caption: string; sample: string; style: string; styles: [string,string,string];
  scene: string; scenes: [string,string,string]; compare: string; sequence: string;
  next: string; operation: string;
};
