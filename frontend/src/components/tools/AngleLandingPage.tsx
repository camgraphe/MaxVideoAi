import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, ChevronRight, Play } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { Link } from '@/i18n/navigation';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const ANGLE_SOURCE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp';
const ANGLE_OUTPUT_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';
const ANGLE_ALT_THREE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/79fe6fd7-60cf-4419-a143-a2cb52e9b762.webp';
const ANGLE_ALT_FOUR_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/cf9ff473-5f6f-4877-b5fd-aafc36bddeb8.webp';
const ANGLE_WORKSPACE_SCREENSHOT_PATH = '/assets/tools/angle-workspace.png';

type AngleLandingContent = Dictionary['toolMarketing']['angle'];
type AngleThumbContent = {
  label: string;
  note: string;
  alt: string;
};

function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function SectionHeader({
  eyebrow,
  title,
  body,
  light = false,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl stack-gap-sm">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
          light ? 'text-slate-300' : 'text-text-muted'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`text-3xl font-semibold tracking-tight sm:text-4xl ${
          light ? 'text-white' : 'text-text-primary'
        }`}
      >
        {title}
      </h2>
      <div className={`text-sm leading-7 sm:text-base ${light ? 'text-slate-300' : 'text-text-secondary'}`}>{body}</div>
    </div>
  );
}

function LinkChip({
  href,
  label,
  dark = false,
}: {
  href: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
        dark
          ? 'border-white/12 bg-white/6 text-white hover:border-white/20 hover:bg-white/10'
          : 'border-hairline bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }`}
    >
      {label}
    </Link>
  );
}

function AngleThumb({
  label,
  note,
  src,
  alt,
  background,
  imageClassName = 'object-cover object-center',
}: {
  label: string;
  note: string;
  src: string;
  alt: string;
  background: string;
  imageClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-hairline bg-white">
      <div className={`relative aspect-[4/3] ${background}`}>
        <Image src={src} alt={alt} fill sizes="180px" className={imageClassName} />
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">{label}</p>
        <p className="text-xs leading-5 text-text-secondary">{note}</p>
      </div>
    </div>
  );
}

function ProductAngleMock({
  beforeLabel,
  afterLabel,
}: {
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="rounded-[22px] border border-hairline bg-[linear-gradient(180deg,#f5f8fb,#ffffff)] p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="rounded-[18px] border border-hairline bg-white p-4">
          <div className="mx-auto h-28 w-20 rounded-[22px] bg-[linear-gradient(180deg,#334155,#0f172a)] shadow-[0_18px_26px_rgba(15,23,42,0.14)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{beforeLabel}</div>
        </div>
        <ArrowRight className="mx-auto h-4 w-4 text-brand" />
        <div className="rounded-[18px] border border-hairline bg-white p-4">
          <div className="mx-auto h-28 w-20 origin-bottom-left rotate-[-12deg] rounded-[22px] bg-[linear-gradient(180deg,#1d4ed8,#0f172a)] shadow-[24px_0_32px_rgba(15,23,42,0.16)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{afterLabel}</div>
        </div>
      </div>
    </div>
  );
}

function HeroAngleFlowPanel({ content }: { content: AngleLandingContent['hero']['panel'] }) {
  return (
    <div className="overflow-hidden rounded-[36px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_42px_140px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-7">
        <span>{content.topLeft}</span>
        <span>{content.topRight}</span>
      </div>
      <div className="grid gap-5 p-6 sm:p-7 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.08fr)] lg:items-center">
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{content.sourceLabel}</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#dce7f3]">
              <Image
                src={ANGLE_SOURCE_URL}
                alt={content.sourceAlt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 520px"
                className="object-cover"
              />
            </div>
          </div>
          <div className="grid gap-4 justify-items-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="grid w-full gap-2">
              {content.controls.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-3 text-center"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{content.outputLabel}</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#d9e6f3]">
              <Image
                src={ANGLE_OUTPUT_URL}
                alt={content.outputAlt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {content.bullets.map((item) => (
            <div key={item} className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-4 py-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <p className="text-sm leading-6 text-slate-200">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceShowcase({ content }: { content: AngleLandingContent['workspace'] }) {
  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>{content.topLeft}</span>
        <span>{content.topRight}</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{content.windowLabel}</span>
          </div>
          <div className="relative aspect-[16/9]">
            <Image
              src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
              alt={content.imageAlt}
              fill
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {content.callouts.map((item) => (
          <div key={item.title} className="bg-[rgba(7,13,21,0.92)] px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputCard({
  eyebrow,
  title,
  body,
  visual,
  className = '',
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <Card
      className={`overflow-hidden p-0 ${
        dark ? 'border-slate-800 bg-[#09111c] text-white' : 'border-hairline bg-surface'
      } ${className}`}
    >
      <div
        className={`border-b p-4 sm:p-5 ${
          dark
            ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]'
            : 'border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,249,252,0.96))]'
        }`}
      >
        {visual}
      </div>
      <div className="stack-gap-sm p-6">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${dark ? 'text-slate-300' : 'text-text-muted'}`}>
          {eyebrow}
        </p>
        <h3 className={`text-xl font-semibold ${dark ? 'text-white' : 'text-text-primary'}`}>{title}</h3>
        <p className={`text-sm leading-7 ${dark ? 'text-slate-300' : 'text-text-secondary'}`}>{body}</p>
      </div>
    </Card>
  );
}

export function AngleLandingPage({ content }: { content: AngleLandingContent }) {
  const canonicalUrl = 'https://maxvideoai.com/tools/angle';
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: content.breadcrumb.home,
        item: 'https://maxvideoai.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: content.breadcrumb.tools,
        item: 'https://maxvideoai.com/tools',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: content.breadcrumb.current,
        item: canonicalUrl,
      },
    ],
  };
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    name: content.meta.schemaName,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonicalUrl,
    description: content.meta.schemaDescription,
    featureList: content.meta.schemaFeatures,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: content.meta.howToTitle,
    description: content.meta.howToDescription,
    step: content.howItWorks.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  };
  const compositionCard = content.outputsPipeline.cards[0]! as {
    eyebrow: string;
    title: string;
    body: string;
    sourceAlt: string;
    outputAlt: string;
  };
  const portraitCard = content.outputsPipeline.cards[1]! as {
    eyebrow: string;
    title: string;
    body: string;
    sourceAlt: string;
    outputAlt: string;
  };
  const angleSetCard = content.outputsPipeline.cards[2]! as {
    eyebrow: string;
    title: string;
    body: string;
    thumbs: [AngleThumbContent, AngleThumbContent, AngleThumbContent, AngleThumbContent];
  };
  const originalAngleThumb = angleSetCard.thumbs[0]!;
  const lowAngleThumb = angleSetCard.thumbs[1]!;
  const threeQuarterAngleThumb = angleSetCard.thumbs[2]!;
  const highAngleThumb = angleSetCard.thumbs[3]!;
  const [storyOriginalThumb, storyThreeQuarterThumb, storyWorkspaceThumb] = content.useCases.story.thumbs as [
    AngleThumbContent,
    AngleThumbContent,
    AngleThumbContent,
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-hairline bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_28%),radial-gradient(circle_at_right,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))]">
        <div className="container-page relative max-w-7xl py-8 sm:py-10 lg:py-12">
          <div className="stack-gap-lg">
            <div className="max-w-4xl stack-gap-lg">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <Link href="/" className="transition hover:text-text-primary">
                  {content.breadcrumb.home}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/tools" className="transition hover:text-text-primary">
                  {content.breadcrumb.tools}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-text-secondary">{content.breadcrumb.current}</span>
              </nav>

              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f5d7a] sm:text-xs">{content.hero.eyebrow}</p>
              </div>

              <div className="stack-gap-sm">
                <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[4.25rem] lg:leading-[0.98]">
                  {content.hero.title}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/app/tools/angle" linkComponent={Link} size="lg">
                  {content.hero.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="/examples" linkComponent={Link} variant="outline" size="lg">
                  {content.hero.secondaryCta}
                </ButtonLink>
              </div>
            </div>

            <div className="mt-2 sm:mt-4">
              <p className="mb-4 text-sm font-medium text-text-secondary">{content.hero.supportText}</p>
            </div>

            <HeroAngleFlowPanel content={content.hero.panel} />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow={content.problemSolution.eyebrow}
            title={content.problemSolution.title}
            body={<p>{content.problemSolution.body}</p>}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-0 text-white">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.problemSolution.problem.label}</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">{content.problemSolution.problem.title}</h3>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-slate-300">
                <p>{content.problemSolution.problem.body}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {content.problemSolution.problem.items.map((item) => (
                    <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-sm font-medium text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,252,0.98))] p-0">
              <div className="border-b border-hairline px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.problemSolution.solution.label}</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{content.problemSolution.solution.title}</h3>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-text-secondary">
                <p>{content.problemSolution.solution.body}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#edf3f8]">
                      <Image
                        src={ANGLE_SOURCE_URL}
                        alt={content.problemSolution.solution.sourceAlt}
                        fill
                        sizes="260px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 text-brand" />
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#e8f0f8]">
                      <Image
                        src={ANGLE_OUTPUT_URL}
                        alt={content.problemSolution.solution.outputAlt}
                        fill
                        sizes="360px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-text-primary">{content.problemSolution.solution.caption}</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow={content.howItWorks.eyebrow}
            title={content.howItWorks.title}
            body={<p>{content.howItWorks.body}</p>}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {content.howItWorks.steps.map((step, index) => (
              <Card
                key={step.title}
                id={`step-${index + 1}`}
                className="border-hairline bg-bg/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.workspace.eyebrow} title={content.workspace.title} body={<p>{content.workspace.body}</p>} />
          <WorkspaceShowcase content={content.workspace} />
        </div>
      </section>

      <section className="border-t border-hairline bg-[#09111c] section text-white">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow={content.outputsPipeline.eyebrow}
            title={content.outputsPipeline.title}
            light
            body={<p>{content.outputsPipeline.body}</p>}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start">
            <div className="grid gap-4 md:grid-cols-2">
              <OutputCard
                eyebrow={compositionCard.eyebrow}
                title={compositionCard.title}
                body={compositionCard.body}
                visual={
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                      <Image
                        src={ANGLE_SOURCE_URL}
                        alt={compositionCard.sourceAlt}
                        fill
                        sizes="320px"
                        className="object-cover"
                      />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                      <Image
                        src={ANGLE_OUTPUT_URL}
                        alt={compositionCard.outputAlt}
                        fill
                        sizes="320px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                }
              />
              <OutputCard
                eyebrow={portraitCard.eyebrow}
                title={portraitCard.title}
                body={portraitCard.body}
                visual={
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                      <Image
                        src={ANGLE_SOURCE_URL}
                        alt={portraitCard.sourceAlt}
                        fill
                        sizes="260px"
                        className="object-cover"
                      />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                      <Image
                        src={ANGLE_ALT_THREE_URL}
                        alt={portraitCard.outputAlt}
                        fill
                        sizes="260px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                }
              />
              <OutputCard
                eyebrow={angleSetCard.eyebrow}
                title={angleSetCard.title}
                body={angleSetCard.body}
                className="md:col-span-2"
                visual={
                  <div className="grid grid-cols-2 gap-3">
                    <AngleThumb
                      label={originalAngleThumb.label}
                      note={originalAngleThumb.note}
                      src={ANGLE_SOURCE_URL}
                      alt={originalAngleThumb.alt}
                      background="bg-[#edf3f8]"
                    />
                    <AngleThumb
                      label={lowAngleThumb.label}
                      note={lowAngleThumb.note}
                      src={ANGLE_OUTPUT_URL}
                      alt={lowAngleThumb.alt}
                      background="bg-[#e8f0f8]"
                    />
                    <AngleThumb
                      label={threeQuarterAngleThumb.label}
                      note={threeQuarterAngleThumb.note}
                      src={ANGLE_ALT_THREE_URL}
                      alt={threeQuarterAngleThumb.alt}
                      background="bg-[#e8f0f8]"
                    />
                    <AngleThumb
                      label={highAngleThumb.label}
                      note={highAngleThumb.note}
                      src={ANGLE_ALT_FOUR_URL}
                      alt={highAngleThumb.alt}
                      background="bg-[#e8f0f8]"
                    />
                  </div>
                }
              />
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/5 p-0 text-white shadow-[0_32px_90px_rgba(0,0,0,0.22)]">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.outputsPipeline.pipeline.label}</p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">{content.outputsPipeline.pipeline.title}</h3>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {content.outputsPipeline.pipeline.badge}
                  </div>
                </div>
              </div>

              <div className="stack-gap-lg p-6">
                <div className="stack-gap-sm">
                  {content.outputsPipeline.pipeline.steps.map((item, index) => (
                    <div key={item.title} className="stack-gap-sm">
                      <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white">{item.body}</p>
                      </div>
                      {index < content.outputsPipeline.pipeline.steps.length - 1 ? (
                        <div className="flex justify-center">
                          <ArrowRight className="h-4 w-4 rotate-90 text-slate-400" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <p className="text-sm leading-7 text-slate-300">
                  {content.outputsPipeline.pipeline.linkSentence.beforeImage}{' '}
                  <Link href="/app/image" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                    {content.outputsPipeline.pipeline.linkSentence.imageLabel}
                  </Link>{' '}
                  {content.outputsPipeline.pipeline.linkSentence.between}{' '}
                  <Link href="/app" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                    {content.outputsPipeline.pipeline.linkSentence.videoLabel}
                  </Link>{' '}
                  {content.outputsPipeline.pipeline.linkSentence.afterVideo}
                </p>

                <div className="flex flex-wrap gap-3">
                  {content.outputsPipeline.pipeline.links.map((link) => (
                    <LinkChip key={link.href} href={link.href} label={link.label} dark />
                  ))}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                    <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#dbe6f3]">
                        <Image
                          src={ANGLE_OUTPUT_URL}
                          alt={content.outputsPipeline.pipeline.preview.leftAlt}
                          fill
                          sizes="220px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <ArrowRight className="mx-auto h-5 w-5 text-slate-300" />
                    <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(14,116,144,0.34),rgba(29,78,216,0.18))]">
                        <Image
                          src={ANGLE_OUTPUT_URL}
                          alt={content.outputsPipeline.pipeline.preview.rightAlt}
                          fill
                          sizes="320px"
                          className="object-cover opacity-85"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#08111c] via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          <span>{content.outputsPipeline.pipeline.preview.readyLabel}</span>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.benefits.eyebrow} title={content.benefits.title} body={<p>{content.benefits.body}</p>} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.benefits.items.map((benefit, index) => (
              <Card key={benefit.title} className="border-hairline bg-surface p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {(index + 1).toString().padStart(2, '0')}
                </div>
                <h3 className="text-lg font-semibold text-text-primary">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{benefit.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader eyebrow={content.useCases.eyebrow} title={content.useCases.title} body={<p>{content.useCases.body}</p>} />

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="overflow-hidden border-hairline bg-bg p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,249,252,0.96))] p-5">
                <div className="grid grid-cols-3 gap-3">
                  <AngleThumb
                    label={storyOriginalThumb.label}
                    note={storyOriginalThumb.note}
                    src={ANGLE_SOURCE_URL}
                    alt={storyOriginalThumb.alt}
                    background="bg-[#edf3f8]"
                  />
                  <AngleThumb
                    label={storyThreeQuarterThumb.label}
                    note={storyThreeQuarterThumb.note}
                    src={ANGLE_ALT_THREE_URL}
                    alt={storyThreeQuarterThumb.alt}
                    background="bg-[#e8f0f8]"
                  />
                  <AngleThumb
                    label={storyWorkspaceThumb.label}
                    note={storyWorkspaceThumb.note}
                    src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
                    alt={storyWorkspaceThumb.alt}
                    background="bg-[#dce8ff]"
                    imageClassName="object-cover object-top"
                  />
                </div>
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.useCases.story.eyebrow}</p>
                <h3 className="text-xl font-semibold text-text-primary">{content.useCases.story.title}</h3>
                <p className="text-sm leading-7 text-text-secondary">{content.useCases.story.body}</p>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-bg p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(241,247,252,0.96))] p-5">
                <ProductAngleMock
                  beforeLabel={content.useCases.commerce.mockBeforeLabel}
                  afterLabel={content.useCases.commerce.mockAfterLabel}
                />
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{content.useCases.commerce.eyebrow}</p>
                <h3 className="text-xl font-semibold text-text-primary">{content.useCases.commerce.title}</h3>
                <p className="text-sm leading-7 text-text-secondary">{content.useCases.commerce.body}</p>
              </div>
            </Card>

            {content.useCases.smallCases.map((useCase) => (
              <Card key={useCase.title} className="border-hairline bg-bg p-6 lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{useCase.eyebrow}</p>
                <h3 className="mt-3 text-xl font-semibold text-text-primary">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{useCase.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-4xl stack-gap-lg">
          <SectionHeader eyebrow={content.faq.eyebrow} title={content.faq.title} body={<p>{content.faq.body}</p>} />
          <div className="stack-gap-sm">
            {content.faq.items.map((faq) => (
              <details
                key={faq.question}
                className="rounded-[24px] border border-hairline bg-surface p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">{faq.question}</summary>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section halo-workspace-bottom">
        <div className="container-page max-w-6xl">
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(20,48,76,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.finalCta.eyebrow}</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.finalCta.title}</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>{content.finalCta.body}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink
                    href="/app/tools/angle"
                    linkComponent={Link}
                    size="lg"
                    className="bg-white text-slate-950 hover:bg-slate-100"
                  >
                    {content.finalCta.primaryCta}
                  </ButtonLink>
                  <ButtonLink
                    href="/tools"
                    linkComponent={Link}
                    variant="outline"
                    size="lg"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {content.finalCta.secondaryCta}
                  </ButtonLink>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <span>{content.finalCta.panelLeft}</span>
                  <span>{content.finalCta.panelRight}</span>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#dce7f3]">
                  <Image
                    src={ANGLE_OUTPUT_URL}
                    alt={content.finalCta.panelAlt}
                    fill
                    sizes="420px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <FAQSchema questions={[...content.faq.items]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </>
  );
}
