import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { ButtonLink } from '@/components/ui/Button';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getTranslations } from 'next-intl/server';

const WORKFLOWS_SLUG_MAP = buildSlugMap('workflows');

export const revalidate = 60 * 10;

type WorkflowExampleEntry = { label: string; slug: string; brandId: string };
type WorkflowStep = { title: string; description: string };
type WorkflowFeature = { title: string; description: string };
type WorkflowFaq = { question: string; answer: string };

const FALLBACK_STEPS: WorkflowStep[] = [
  {
    title: 'Choose engine & mode',
    description: 'Text-to-video, image-to-video, plus references when supported.',
  },
  {
    title: 'Set shot settings',
    description: 'Duration, aspect, resolution, iterations, and audio when available.',
  },
  {
    title: 'Write prompt + add references',
    description: 'Add a prompt and optional reference assets.',
  },
  {
    title: 'Generate + review variants',
    description: 'Preview a grid, copy prompts, and download per clip.',
  },
];

const FALLBACK_FEATURES: WorkflowFeature[] = [
  {
    title: 'Live price-before-you-generate',
    description: 'The price chip updates as settings change.',
  },
  {
    title: 'Generate 1-4 variants per run',
    description: 'Iterations create multiple takes in one go.',
  },
  {
    title: 'Copy prompt from any result',
    description: 'Reuse prompts directly from past takes.',
  },
  {
    title: 'Continue / Refine',
    description: 'Prefill settings from a chosen take and iterate.',
  },
  {
    title: 'Per-clip downloads',
    description: 'Download each clip individually.',
  },
  {
    title: 'History you can revisit',
    description: 'Find runs in /jobs and the public gallery.',
  },
];

const FALLBACK_EXAMPLES: WorkflowExampleEntry[] = [
  { label: 'Sora 2', slug: 'sora-2', brandId: 'openai' },
  { label: 'Veo 3.1', slug: 'veo-3-1', brandId: 'google-veo' },
  { label: 'Kling 2.6 Pro', slug: 'kling-2-6-pro', brandId: 'kling' },
  { label: 'Pika Text-to-Video', slug: 'pika-text-to-video', brandId: 'pika' },
  { label: 'Wan 2.6', slug: 'wan-2-6', brandId: 'wan' },
  { label: 'LTX-2', slug: 'ltx-2', brandId: 'lightricks' },
  { label: 'LTX-2 Fast', slug: 'ltx-2-fast', brandId: 'lightricks' },
  { label: 'MiniMax Hailuo 02', slug: 'minimax-hailuo-02-text', brandId: 'minimax' },
];

const FALLBACK_FAQ: WorkflowFaq[] = [
  {
    question: 'How does \"price before you generate\" work?',
    answer: 'The price chip updates as you change engine, duration, and resolution. You are charged only on success.',
  },
  {
    question: 'What do iterations mean?',
    answer: 'Iterations generate 1-4 variants in a single run using the same settings.',
  },
  {
    question: 'Why do duration/resolution/aspect options differ by engine?',
    answer: 'Each engine exposes its own caps, so the UI only shows what that engine supports.',
  },
  {
    question: 'When is audio available?',
    answer: 'Audio appears only on engines that support it, with a toggle when available.',
  },
  {
    question: 'Where do I find past runs?',
    answer: 'Open /jobs for your history and /examples for curated prompts you can reuse.',
  },
];

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'workflows.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'workflows',
    slugMap: WORKFLOWS_SLUG_MAP,
    imageAlt: 'Workflows - MaxVideo AI',
    robots: {
      index: true,
      follow: true,
    },
  });
}

export default async function WorkflowsPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.workflows;
  const steps: WorkflowStep[] =
    Array.isArray(content.how?.steps) && content.how.steps.length ? content.how.steps : FALLBACK_STEPS;
  const features: WorkflowFeature[] =
    Array.isArray(content.capabilities?.items) && content.capabilities.items.length
      ? content.capabilities.items
      : FALLBACK_FEATURES;
  const exampleEntries: WorkflowExampleEntry[] =
    Array.isArray(content.examples?.items) && content.examples.items.length ? content.examples.items : FALLBACK_EXAMPLES;
  const faqItems: WorkflowFaq[] = Array.isArray(content.faq?.items) && content.faq.items.length ? content.faq.items : FALLBACK_FAQ;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };

  return (
    <div className="container-page max-w-5xl section">
      <div className="stack-gap-xl">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
            {content.hero?.title ?? 'Workflows'}
          </h1>
          <p className="sm:max-w-[62ch] text-sm text-text-muted">
            {content.hero?.subtitle ??
              'Your repeatable AI video workflow: pick an engine, set the shot, preview price, and generate variants you can reuse.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/app" prefetch={false} size="lg" className="shadow-card" linkComponent={Link}>
              {content.hero?.primaryCta ?? 'Generate now'}
            </ButtonLink>
            <ButtonLink href={{ pathname: '/examples' }} variant="outline" size="lg" linkComponent={Link}>
              {content.hero?.secondaryCta ?? 'Browse examples'}
            </ButtonLink>
            <Link
              href={{ pathname: '/models' }}
              className="text-sm font-semibold text-text-secondary underline underline-offset-4 transition hover:text-text-primary"
            >
              {content.hero?.tertiaryCta ?? 'Compare models'}
            </Link>
          </div>
        </header>

        <section id="how-it-works" className="rounded-2xl border border-hairline bg-surface/80 p-6 shadow-card">
          <div className="stack-gap-sm">
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
              {content.how?.title ?? 'How it works (live)'}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-hairline bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-xs font-semibold text-text-muted">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="what-you-can-do" className="rounded-2xl border border-hairline bg-surface/80 p-6 shadow-card">
          <div className="stack-gap-sm">
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
              {content.capabilities?.title ?? 'What you can do today'}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-hairline bg-surface p-4">
                  <h3 className="text-sm font-semibold text-text-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" className="rounded-2xl border border-hairline bg-surface/80 p-6 shadow-card">
          <div className="stack-gap-sm">
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
              {content.examples?.title ?? 'Examples (real prompts you can reuse)'}
            </h2>
            <p className="text-sm text-text-secondary">
              {content.examples?.subtitle ?? 'Open an example -> reuse the prompt -> run it in /app.'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {exampleEntries.map((entry) => {
                const accentId = entry.brandId || 'google';
                return (
                <Link
                  key={entry.slug}
                  href={{ pathname: '/examples/[model]', params: { model: entry.slug } }}
                  className="group flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-3 text-left transition hover:bg-surface-2 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: `var(--engine-${accentId}-bg)` }}
                    />
                    {entry.label}
                  </span>
                  <span className="text-xs text-text-muted transition group-hover:text-text-primary">View &rarr;</span>
                </Link>
              );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="rounded-2xl border border-hairline bg-surface/80 p-6 shadow-card">
          <div className="stack-gap-sm">
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
              {content.faq?.title ?? 'FAQ (live)'}
            </h2>
            <div className="space-y-3">
              {faqItems.map((entry) => (
                <details
                  key={entry.question}
                  className="group rounded-2xl border border-hairline bg-surface px-4 py-3"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-text-primary">
                    {entry.question}
                  </summary>
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-hairline bg-surface/80 p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
                {content.cta?.title ?? 'Start generating in seconds'}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {content.cta?.subtitle ?? 'Pick an engine, set your shot, preview price, generate variants.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/app" prefetch={false} size="lg" className="shadow-card" linkComponent={Link}>
                {content.cta?.primaryCta ?? 'Generate now'}
              </ButtonLink>
              <ButtonLink href={{ pathname: '/examples' }} variant="outline" size="lg" linkComponent={Link}>
                {content.cta?.secondaryCta ?? 'Browse examples'}
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
    </div>
  );
}
