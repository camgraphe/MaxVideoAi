import type { ModelFamilyId } from '@/config/model-families';

export type ExampleFaqItem = {
  question: string;
  answer: string;
};

export type ExampleSectionItem = {
  title: string;
  body: string;
};

export type ExampleModelLanding = {
  slug: string;
  label: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  summary: string;
  sections: ExampleSectionItem[];
  faqTitle: string;
  faqItems: ExampleFaqItem[];
};

export type CanonicalExampleModelSlug = ModelFamilyId;

export type LocalizedModelDescriptor = {
  metaTitle?: string;
  metaDescription?: string;
  heroTitle?: string;
  summary?: string;
  subtitle: string;
  intro: string;
  promptPatterns: string;
  strengthsLimits: string;
  pricingNotes: string;
  faq: ExampleFaqItem[];
};
