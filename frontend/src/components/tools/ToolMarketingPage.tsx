import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type ToolLink = {
  href: string;
  label: string;
};

type ToolStep = {
  title: string;
  body: string;
};

type ToolCard = {
  title: string;
  body: string;
  eyebrow?: string;
  visual?: ReactNode;
};

type ToolFaq = {
  question: string;
  answer: string;
};

type ToolMarketingPageProps = {
  canonicalPath: string;
  breadcrumbTitle: string;
  productLabel: string;
  title: string;
  intro: string;
  proofBullets: string[];
  primaryCta: ToolLink;
  secondaryCta: ToolLink;
  heroVisual: ReactNode;
  heroPanelClassName?: string;
  problemTitle: string;
  problemBody: ReactNode;
  solutionTitle: string;
  solutionBody: ReactNode;
  howItWorksTitle: string;
  steps: ToolStep[];
  outputTitle: string;
  outputCards: ToolCard[];
  benefitsTitle: string;
  benefitCards: ToolCard[];
  workflowTitle: string;
  workflowBody: ReactNode;
  workflowLinks: ToolLink[];
  useCasesTitle: string;
  useCaseCards: ToolCard[];
  faqTitle: string;
  faqs: ToolFaq[];
  finalTitle: string;
  finalBody: ReactNode;
  finalCta: ToolLink;
  schemaDescription: string;
  schemaFeatures: string[];
};

function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function SectionIntro({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="max-w-3xl stack-gap-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{title}</h2>
      <div className="text-sm leading-7 text-text-secondary sm:text-base">{body}</div>
    </div>
  );
}

function CardGrid({ cards }: { cards: ToolCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden border-hairline bg-surface p-0">
          {card.visual ? (
            <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(246,248,251,0.94))] p-4">
              {card.visual}
            </div>
          ) : null}
          <div className="stack-gap-sm p-5">
            {card.eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">{card.eyebrow}</p>
            ) : null}
            <h3 className="text-lg font-semibold text-text-primary">{card.title}</h3>
            <p className="text-sm leading-6 text-text-secondary">{card.body}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ToolMarketingPage({
  canonicalPath,
  breadcrumbTitle,
  productLabel,
  title,
  intro,
  proofBullets,
  primaryCta,
  secondaryCta,
  heroVisual,
  heroPanelClassName,
  problemTitle,
  problemBody,
  solutionTitle,
  solutionBody,
  howItWorksTitle,
  steps,
  outputTitle,
  outputCards,
  benefitsTitle,
  benefitCards,
  workflowTitle,
  workflowBody,
  workflowLinks,
  useCasesTitle,
  useCaseCards,
  faqTitle,
  faqs,
  finalTitle,
  finalBody,
  finalCta,
  schemaDescription,
  schemaFeatures,
}: ToolMarketingPageProps) {
  const canonicalUrl = `https://maxvideoai.com${canonicalPath}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://maxvideoai.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: 'https://maxvideoai.com/tools',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumbTitle,
        item: canonicalUrl,
      },
    ],
  };
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    name: breadcrumbTitle,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonicalUrl,
    description: schemaDescription,
    featureList: schemaFeatures,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howItWorksTitle,
    description: schemaDescription,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  };

  return (
    <>
      <section className="section halo-hero overflow-hidden">
        <div className="container-page max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
            <div className="stack-gap-lg">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <Link href="/" className="transition hover:text-text-primary">
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/tools" className="transition hover:text-text-primary">
                  Tools
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-text-secondary">{breadcrumbTitle}</span>
              </nav>

              <div className="stack-gap">
                <div className="inline-flex w-fit items-center rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted shadow-card">
                  {productLabel}
                </div>
                <div className="stack-gap-sm">
                  <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">{title}</h1>
                  <p className="max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">{intro}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink href={primaryCta.href} size="lg">
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href={secondaryCta.href} variant="outline" size="lg">
                  {secondaryCta.label}
                </ButtonLink>
              </div>

              <ul className="grid gap-3 sm:grid-cols-3">
                {proofBullets.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-[22px] border border-hairline bg-surface/90 px-4 py-4 text-sm leading-6 text-text-secondary shadow-card"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={`rounded-[32px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(243,246,250,0.95))] p-4 shadow-card sm:p-5 ${
                heroPanelClassName ?? ''
              }`}
            >
              {heroVisual}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl">
          <SectionIntro title={problemTitle} body={problemBody} />
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl">
          <SectionIntro title={solutionTitle} body={solutionBody} />
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionIntro
            title={howItWorksTitle}
            body={<p>Start with a strong reference, lock the asset, then reuse it throughout the rest of your workflow.</p>}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step.title} className="border-hairline bg-bg/80 p-6" id={`step-${index + 1}`}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionIntro title={outputTitle} body={<p>Use these outputs as reusable assets before you move into prompt variations, image edits, or motion generation.</p>} />
          <CardGrid cards={outputCards} />
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionIntro title={benefitsTitle} body={<p>These tools are designed to reduce avoidable regeneration and give you a cleaner starting point for the rest of the stack.</p>} />
          <CardGrid cards={benefitCards} />
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionIntro title={workflowTitle} body={workflowBody} />
          <div className="flex flex-wrap gap-3">
            {workflowLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionIntro title={useCasesTitle} body={<p>These workflows make sense anywhere you need more reliable assets before you commit budget to generation or iteration.</p>} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {useCaseCards.map((card) => (
              <Card key={card.title} className="border-hairline bg-bg/80 p-5">
                <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{card.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-4xl stack-gap-lg">
          <SectionIntro title={faqTitle} body={<p>Short answers to the questions people ask before they start building a reusable image-to-video pipeline.</p>} />
          <div className="stack-gap-sm">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-[22px] border border-hairline bg-surface p-5 shadow-card">
                <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">
                  {faq.question}
                </summary>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section halo-workspace-bottom">
        <div className="container-page max-w-5xl">
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(12,18,28,0.98),rgba(31,55,82,0.96))] p-0 text-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]">
            <div className="grid gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="stack-gap-sm">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{finalTitle}</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{finalBody}</div>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <ButtonLink href={finalCta.href} size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                  {finalCta.label}
                </ButtonLink>
                <ButtonLink href="/tools" variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  Browse Tools
                </ButtonLink>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <FAQSchema questions={faqs.slice(0, 6)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </>
  );
}
