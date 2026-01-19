import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveDictionary } from '@/lib/i18n/server';

const COMPARE_SLUG_MAP = buildSlugMap('compare');

const LINK_TARGETS = {
  article: { href: { pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } } },
  sora: { href: { pathname: '/models/[slug]', params: { slug: 'sora-2' } } },
  veo: { href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1' } } },
  pika: { href: { pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } } },
  veoFast: { href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1-fast' } } },
  hailuo: { href: { pathname: '/models/[slug]', params: { slug: 'minimax-hailuo-02-text' } } },
  models: { href: '/models' },
  pricing: { href: '/pricing' },
  blog: { href: '/blog' },
} as const;

type RichKey = keyof typeof LINK_TARGETS;

type SectionCopy = {
  title: string;
  body: string;
};

type ComparisonCard = {
  label: string;
  title: string;
  points: string[];
};

const DEFAULT_CONTENT = {
  hero: {
    title: 'Run AI Video Generators in Europe — Sora 2, Veo 3, Pika & More',
    intro:
      'MaxVideoAI keeps cinematic text-to-video engines compliant, monitored, and production-ready for European teams. Use this hub to understand availability, compare creative trade-offs, and launch projects with the right guardrails from day one.',
    secondary: 'Not sure which model to pick? Read our {{article:comparison article}}.',
  },
  sections: [
    {
      title: 'Sora 2 availability and alternatives',
      body:
        'Sora 2 remains a staged rollout, so MaxVideoAI handles the verification trail, regional compliance, and predictive routing when capacity spikes. Producers can benchmark storyboards against {{sora:Sora 2 reference projects}} and switch to Sora 2 Pro presets or Veo 3 sequences when turnaround speed matters more than frontier fidelity. We document prompt structures, footage approvals, and post-production best practices so every brief stays aligned with OpenAI review criteria while still shipping on time. Regional producers also receive weekly availability notes covering audio support, frame length, and compliance traceability for regulated sectors.',
    },
    {
      title: 'Veo 3: cinematic text-to-video for creators',
      body:
        'Veo 3.1 bridges the gap between storyboard accuracy and polished motion, especially when social or advertising deliverables need voice-over sync. Our routing keeps latency predictable and lets directors compare the fast preset with the longer-run tier before booking studio time. Review the latest guardrails, aspect ratios, and narration-ready examples on the {{veo:Veo 3.1 overview}} or tap the Fast variant when iteration speed outranks audio or frame count. We also surface a change log inside the workspace so editors can see when motion controls, audio fidelity, or policy notes adjust between releases.',
    },
    {
      title: 'Pika 2.2 for fast social content',
      body:
        'When teams need playful loops or short-form edits, Pika 2.2 delivers multi-aspect outputs at a fraction of the budget. MaxVideoAI exposes curated presets so editors can jump from vertical reels to square product shots without leaving the workspace. Compare text-to-video and image-to-video modes side-by-side on our {{pika:Pika quickstart guide}} and reuse prompt banks that have already been cleared for brand-safe campaigns. Daily QA passes flag style drift or artefacts so you know when to regenerate, upscale, or hand off to animators for refinement.',
    },
    {
      title: 'How MaxVideoAI routes Fal.ai engines',
      body:
        'Fal.ai powers the multi-engine routing backbone behind MaxVideoAI, letting us burst to capacity while surfacing a consistent interface to creative leads. Our orchestration layer keeps prompts portable, logs every render, and exposes diagnostics so you know when to retry or hand off to another engine like {{veoFast:Veo 3.1 Fast}} or {{hailuo:MiniMax Hailuo}} for stylised outputs. Teams also gain access to rate cards, audit trails, and regional compliance notes in one workspace, and automated playbooks explain how to escalate priority or swap render regions when demand peaks.',
    },
  ] as SectionCopy[],
  comparison: {
    title: 'Compare the top video generators',
    intro:
      'Whether you need frontier fidelity or budget-friendly loops, MaxVideoAI keeps each engine ready for production workloads.',
    cards: [
      {
        label: 'Sora 2',
        title: 'Fidelity-first',
        points: [
          'Frontier video model with native audio',
          'Strict review loop, longer queue times',
          'Ideal for hero campaigns and cinematic briefs',
        ],
      },
      {
        label: 'Veo 3.1',
        title: 'Cinematic speed',
        points: [
          'Bridges storyboard fidelity with fast iteration',
          'Switch between standard and fast queues',
          'Audio-ready for interviews, ads, and explainers',
        ],
      },
      {
        label: 'Pika 2.2',
        title: 'Rapid social loops',
        points: [
          'Fast text or image to video renders',
          'Ideal for reels, teasers, and playful concepts',
          'Budget-friendly credits for experimentation',
        ],
      },
    ] as ComparisonCard[],
  },
  faqTitle: 'AI video routing FAQ',
  faq: [
    {
      question: 'Does MaxVideoAI support European billing for Fal.ai engines?',
      answer:
        'Yes. We process invoices in EUR or GBP and map them to Fal.ai usage so finance teams can reconcile spend without US subsidiaries or prepaid card workarounds.',
    },
    {
      question: 'How quickly can teams launch a Sora 2 project?',
      answer:
        'Most creative teams start prompting within two business days. We keep onboarding templates ready and provide fallback Veo or Pika presets while Sora access is finalised.',
    },
    {
      question: 'Can I monitor model changes without refreshing documentation?',
      answer:
        'The MaxVideoAI workspace highlights latency, output limits, and policy updates in real time, so producers know when to retry or pivot to alternative engines.',
    },
  ],
  cta: {
    body: 'Looking for sequenced prompt recipes? Read the latest guides on the {{blog:MaxVideoAI blog}} for branded storytelling walkthroughs and engine updates.',
  },
} as const;

function renderRichText(text: string | undefined, keyPrefix: string): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  const regex = /\{\{([a-zA-Z0-9_-]+):([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segment = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-text-${segment++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    const token = match[1] as RichKey;
    const label = match[2];
    const target = LINK_TARGETS[token];
    if (target) {
      nodes.push(
        <Link
          key={`${keyPrefix}-link-${segment++}`}
          href={target.href}
          className="font-semibold text-brand hover:text-brandHover"
        >
          {label}
        </Link>
      );
    } else {
      nodes.push(<span key={`${keyPrefix}-text-${segment++}`}>{label}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-text-${segment++}`}>{text.slice(lastIndex)}</span>
    );
  }
  return nodes;
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'aiVideoEngines.meta' });

  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'compare',
    slugMap: COMPARE_SLUG_MAP,
    imageAlt: t('title'),
    ogType: 'article',
    keywords: ['AI video generator', 'Sora 2', 'Veo 3', 'Pika 2.2', 'text-to-video Europe', 'Fal.ai', 'MaxVideoAI'],
    other: { 'og:topic': 'AI video generator comparison' },
  });
}

export default async function AiVideoEnginesPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.aiVideoEngines ?? DEFAULT_CONTENT;
  const hero = content.hero ?? DEFAULT_CONTENT.hero;
  const sections: SectionCopy[] = Array.isArray(content.sections) && content.sections.length ? content.sections : DEFAULT_CONTENT.sections;
  const comparison = content.comparison ?? DEFAULT_CONTENT.comparison;
  const faqItems = Array.isArray(content.faq) && content.faq.length ? content.faq : DEFAULT_CONTENT.faq;
  const faqTitle = content.faqTitle ?? DEFAULT_CONTENT.faqTitle;
  const cta = content.cta ?? DEFAULT_CONTENT.cta;
  const faqJsonLdEntries = faqItems.slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 lg:py-20 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{hero.title}</h1>
        {hero.intro ? <p className="text-base leading-relaxed text-text-secondary">{renderRichText(hero.intro, 'hero-intro')}</p> : null}
        {hero.secondary ? <p className="text-base leading-relaxed text-text-secondary">{renderRichText(hero.secondary, 'hero-secondary')}</p> : null}
      </header>

      <section className="mt-12 space-y-6">
        {sections.map((section, index) => (
          <div key={section.title ?? `section-${index}`} className="space-y-4">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{section.title}</h2>
            {section.body ? (
              <p className="text-base leading-relaxed text-text-secondary">
                {renderRichText(section.body, `section-${index}`)}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-12 space-y-6">
        <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{comparison.title}</h2>
        <p className="text-base leading-relaxed text-text-secondary">{renderRichText(comparison.intro, 'comparison-intro')}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {comparison.cards.map((card) => (
            <article key={card.label} className="space-y-3 rounded-card border border-hairline bg-white p-5 shadow-card">
              <div className="text-sm font-semibold uppercase tracking-micro text-text-muted">{card.label}</div>
              <p className="text-base text-text-primary">{card.title}</p>
              <ul className="list-disc pl-6 text-sm text-text-secondary">
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{faqTitle}</h2>
        <div className="space-y-3 text-base leading-relaxed text-text-secondary">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-card border border-hairline bg-white p-5 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
              <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <FAQSchema questions={faqJsonLdEntries} />

      {cta?.body ? (
        <div className="mt-12 rounded-card border border-hairline bg-white p-6 text-sm leading-relaxed text-text-secondary shadow-card">
          {renderRichText(cta.body, 'cta')}
        </div>
      ) : null}
    </div>
  );
}
