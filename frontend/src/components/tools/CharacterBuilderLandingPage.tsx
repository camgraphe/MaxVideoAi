import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, Play, Sparkles } from 'lucide-react';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const CHARACTER_SHEET_PREVIEW_URL =
  'https://v3b.fal.media/files/b/0a933bb7/R64-QF4-arWq1SzqnpC3r_DPAtirIT.png';
const PORTRAIT_REFERENCE_PREVIEW_URL =
  'https://v3b.fal.media/files/b/0a933bb6/ZPDNLhxRWTb-BWCYSw4b2_MV73KIfo.png';
const CHARACTER_WORKSPACE_HERO_PATH = '/assets/tools/character-builder-workspace.png?hero=1';
const CHARACTER_WORKSPACE_SCREENSHOT_PATH = '/assets/tools/character-builder-workspace.png';

const PROOF_BULLETS = [
  'Reuse the same character across scenes and prompts',
  'Generate reference sheets and multi-view assets',
  'Prepare stronger inputs for image-to-video workflows',
] as const;

const STEPS = [
  {
    title: 'Upload a base character image or start from a concept',
    body: 'Begin with one image you trust or describe the traits you want to preserve before you generate anything else.',
  },
  {
    title: 'Generate a reusable reference sheet or character asset',
    body: 'Turn that starting point into a character sheet, turnaround, or portrait anchor that stays useful after the first render.',
  },
  {
    title: 'Reuse it in later image prompts, scene variations, or image-to-video workflows',
    body: 'Carry the same reference into follow-up scenes, ad concepts, storyboards, or motion-ready first frames inside MaxVideoAI.',
  },
] as const;

const BENEFITS = [
  {
    title: 'Keep character identity stable',
    body: 'A reusable visual anchor helps preserve facial traits, outfits, and proportions when prompts get more complex.',
  },
  {
    title: 'Reduce prompt trial and error',
    body: 'You spend less time restating the same identity and more time iterating on scene direction or storytelling.',
  },
  {
    title: 'Reuse assets across scenes',
    body: 'The same reference can support comics, ads, YouTube series, branded content, and storyboard sequences.',
  },
  {
    title: 'Build stronger first frames for video',
    body: 'A clean reference gives image-to-video models a clearer starting point than a loosely described prompt alone.',
  },
] as const;

const WORKFLOW_LINKS = [
  { href: '/app/image', label: 'Open Image Workspace' },
  { href: '/app', label: 'Open Video Workspace' },
  { href: '/models/veo-3-1', label: 'Veo 3.1' },
  { href: '/models/kling-3-pro', label: 'Kling 3 Pro' },
  { href: '/models/sora-2-pro', label: 'Sora 2 Pro' },
  { href: '/models', label: 'Browse Model Hub' },
  { href: '/examples', label: 'See Examples' },
] as const;

const FAQS = [
  {
    question: 'What is consistent character AI?',
    answer:
      'Consistent character AI is a workflow for turning one image or concept into a reusable character reference that keeps the same face, outfit, and silhouette more stable across later generations.',
  },
  {
    question: 'Can I create a character sheet from one image?',
    answer:
      'Yes. You can start from one image and turn it into a reusable character sheet, portrait anchor, or turnaround-style reference for later prompts and scene work.',
  },
  {
    question: 'Does this help with image-to-video workflows?',
    answer:
      'Yes. A stable reference gives image-to-video models a cleaner first frame and a better visual brief, which helps reduce drift across clips.',
  },
  {
    question: 'Can I create front, side, and back references?',
    answer:
      'Yes. The tool is designed to help you build front, side, and back style references, plus multi-view sheets you can reuse later.',
  },
  {
    question: 'Is this useful for ads, stories, and branded content?',
    answer:
      'Yes. The workflow fits short films, recurring ad talent, creator series, mascots, comic planning, and branded visual systems where identity consistency matters.',
  },
] as const;

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

function HeroProofCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-hairline/80 bg-white/72 px-4 py-3 text-sm leading-6 text-text-secondary shadow-[0_14px_34px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>{children}</span>
      </div>
    </div>
  );
}

function VisualThumb({
  label,
  note,
  src = PORTRAIT_REFERENCE_PREVIEW_URL,
  alt,
  background,
  imageClassName = 'object-cover object-center',
}: {
  label: string;
  note: string;
  src?: string;
  alt: string;
  background: string;
  imageClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
      <div className={`relative aspect-[4/5] ${background}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="180px"
          className={imageClassName}
        />
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">{label}</p>
        <p className="text-xs leading-5 text-slate-300">{note}</p>
      </div>
    </div>
  );
}

function HeroScreenshotPreview() {
  const callouts = [
    {
      label: '01',
      title: 'Choose the output',
      body: 'Switch between portrait anchor and character sheet before you generate.',
    },
    {
      label: '02',
      title: 'Lock the asset',
      body: 'Turn one source image into a reusable reference pack instead of re-solving identity later.',
    },
    {
      label: '03',
      title: 'Move it downstream',
      body: 'Reuse the same asset in image edits and image-to-video with a clearer first frame.',
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-t-[34px] rounded-b-[30px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>Actual tool screenshot</span>
        <span>Character Builder workspace</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              choose output, anchor identity, generate
            </span>
          </div>
          <div className="relative aspect-[16/9]">
            <Image
              src={CHARACTER_WORKSPACE_HERO_PATH}
              alt="Full screenshot of the MaxVideoAI Character Builder workspace."
              fill
              priority
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-[center_12%]"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {callouts.map((item) => (
          <div key={item.label} className="bg-[rgba(7,13,21,0.92)] px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-base font-semibold text-white">{item.title}</p>
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

export function CharacterBuilderLandingPage() {
  const canonicalUrl = 'https://maxvideoai.com/tools/character-builder';
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
        name: 'Consistent Character AI',
        item: canonicalUrl,
      },
    ],
  };
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    name: 'Consistent Character AI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonicalUrl,
    description:
      'Create reusable AI character references and 3-view character sheets from one image before moving into image and video generation.',
    featureList: [
      'Create a reusable character sheet from one image',
      'Generate front, side, and back style references',
      'Reuse the same character across scenes and prompts',
      'Prepare stronger first frames for image-to-video workflows',
    ],
    isPartOf: {
      '@type': 'WebSite',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How It Works',
    description:
      'Build a reusable character reference before image generation and image-to-video.',
    step: STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: `${canonicalUrl}#step-${index + 1}`,
    })),
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-hairline bg-[radial-gradient(circle_at_top_left,rgba(244,127,94,0.12),transparent_28%),radial-gradient(circle_at_right,rgba(76,132,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))]">
        <div className="container-page relative max-w-[88rem] pb-0 pt-8 sm:pt-10 lg:pt-12">
          <div className="max-w-4xl stack-gap-lg">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <Link href="/" className="transition hover:text-text-primary">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/tools" className="transition hover:text-text-primary">
                Tools
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-text-secondary">Consistent Character AI</span>
            </nav>

            <div className="stack-gap-sm">
              <div className="inline-flex w-fit items-center rounded-full border border-hairline bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted shadow-card">
                Consistent Character Builder
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a85a2f] sm:text-xs">
                Build reusable reference assets before image-to-video.
              </p>
            </div>

            <div className="stack-gap-sm">
              <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[4rem] lg:leading-[1.02]">
                Create Consistent AI Characters You Can Reuse Across Scenes
              </h1>
              <p className="max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
                Build reusable character references, character sheets, and first-frame assets for cleaner image generation and
                more stable image-to-video workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/app/tools/character-builder" size="lg">
                Open Tool
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/examples" variant="outline" size="lg">
                See Example Outputs
              </ButtonLink>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {PROOF_BULLETS.map((item) => (
                <HeroProofCard key={item}>{item}</HeroProofCard>
              ))}
            </div>
          </div>

          <div className="mt-8 sm:mt-10 lg:mt-12">
            <HeroScreenshotPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-0 text-white">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Problem</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Why AI Characters Drift From One Scene to the Next</h2>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-slate-300">
                <p>
                  AI images often change the face, outfit, accessories, or proportions from one generation to another. That makes
                  storytelling, ads, comics, and image-to-video workflows harder than they should be.
                </p>
                <p>
                  When your first frame changes every time, prompt quality stops being the only issue. You also lose continuity,
                  spend more time fixing details, and make motion generation less predictable.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    'Face and hair keep changing',
                    'Outfit details drift between prompts',
                    'Proportions stop matching across scenes',
                    'Video first frames become less reliable',
                  ].map((item) => (
                    <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-sm font-medium text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,244,239,0.98))] p-0">
              <div className="border-b border-hairline px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Solution</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                  Build a Reusable Character Reference Before You Generate
                </h2>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-text-secondary">
                <p>
                  Consistent Character Builder helps you create a reusable visual anchor from a single image or character concept.
                  Use it as a character sheet, a reference image, or a starting asset for later image and video generation.
                </p>
                <p>
                  Instead of rebuilding identity in every prompt, you start with a reusable reference that can travel into image
                  variations, campaign iterations, and first-frame video workflows.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[#fff5ee]">
                      <Image
                        src={PORTRAIT_REFERENCE_PREVIEW_URL}
                        alt="Portrait reference used as the base input for a reusable character pack."
                        fill
                        sizes="260px"
                        className="object-cover object-center"
                      />
                    </div>
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 text-brand" />
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <div className="relative aspect-[16/11] overflow-hidden rounded-[18px] bg-[#f8f2ea]">
                    <Image
                      src={CHARACTER_SHEET_PREVIEW_URL}
                      alt="Character sheet output used as the reusable visual anchor."
                      fill
                      sizes="360px"
                        className="object-contain p-4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
            <div className="stack-gap-lg">
              <SectionHeader
                eyebrow="How it works"
                title="How It Works"
                body={
                  <p>
                    Start with a strong reference, lock the asset, then reuse it throughout the rest of your workflow.
                  </p>
                }
              />
              <div className="stack-gap-sm">
                {STEPS.map((step, index) => (
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

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.96))] p-0">
              <div className="border-b border-hairline px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Inside the tool</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
                      Build the asset before you branch into scenes
                    </h3>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    upload → generate → reuse
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="overflow-hidden rounded-[26px] border border-hairline bg-[#eef3f9]">
                  <div className="flex items-center gap-1.5 border-b border-slate-300/60 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      maxvideoai / character builder
                    </span>
                  </div>
                  <div className="relative aspect-[16/11]">
                    <Image
                      src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                      alt="Character Builder workspace screenshot inside MaxVideoAI."
                      fill
                      sizes="(max-width: 1280px) 100vw, 620px"
                      className="object-cover object-top bg-[#f6f9fc]"
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {['Reference portrait', 'Character sheet', 'Video-ready still'].map((item) => (
                    <div key={item} className="rounded-[18px] border border-hairline bg-white px-4 py-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Outputs"
            title="What You Can Generate"
            body={
              <p>
                Use these outputs as reusable assets before you move into prompt variations, image edits, or motion generation.
              </p>
            }
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <OutputCard
              eyebrow="Reference asset"
              title="3-view character sheet"
              body="Create a clean character sheet AI asset that keeps the face, outfit, and overall silhouette stable."
              className="lg:col-span-7"
              visual={
                <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] bg-[#f7f1ea]">
                  <Image
                    src={CHARACTER_SHEET_PREVIEW_URL}
                    alt="3-view character sheet output with stable face, outfit, and silhouette."
                    fill
                    sizes="(max-width: 1280px) 100vw, 600px"
                    className="object-contain p-5"
                  />
                </div>
              }
            />
            <OutputCard
              eyebrow="Portrait anchor"
              title="Reusable reference portrait"
              body="Generate a focused portrait reference you can bring back into image prompts whenever identity drift starts creeping in."
              className="lg:col-span-5"
              visual={
                <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fff4ec,#ffffff)]">
                  <Image
                    src={PORTRAIT_REFERENCE_PREVIEW_URL}
                    alt="Reusable portrait reference for consistent AI character generation."
                    fill
                    sizes="(max-width: 1280px) 100vw, 360px"
                    className="object-cover object-center"
                  />
                </div>
              }
            />
            <OutputCard
              eyebrow="Reusable pack"
              title="Reference asset ready to reuse"
              body="Start with one clean pack, then move between portrait anchors, reusable sheets, and generation controls without rebuilding the workflow from scratch."
              className="lg:col-span-5"
              visual={
                <div className="grid grid-cols-3 gap-3">
                  <VisualThumb
                    label="Portrait"
                    note="Identity anchor"
                    src={PORTRAIT_REFERENCE_PREVIEW_URL}
                    alt="Portrait anchor for the reusable character reference."
                    background="bg-[linear-gradient(180deg,#fde1d3,#fff4ed)]"
                  />
                  <VisualThumb
                    label="Sheet"
                    note="Multi-view pack"
                    src={CHARACTER_SHEET_PREVIEW_URL}
                    alt="Character sheet used as a reusable multi-view pack."
                    background="bg-[linear-gradient(180deg,#f8f1e9,#fff9f3)]"
                    imageClassName="object-contain p-2"
                  />
                  <VisualThumb
                    label="Tool"
                    note="Generate and export"
                    src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                    alt="Character Builder screenshot crop showing the generation controls."
                    background="bg-[linear-gradient(180deg,#dce8ff,#f7fbff)]"
                    imageClassName="object-cover object-bottom"
                  />
                </div>
              }
            />
            <OutputCard
              eyebrow="Turnaround + motion prep"
              title="Front / side / back turnaround to first frame"
              body="Build the turnaround first, then carry the same reference into motion tests and image-to-video workflows with a cleaner first frame."
              className="lg:col-span-7"
              dark
              visual={
                <div className="grid gap-4 md:grid-cols-[minmax(0,0.82fr)_auto_minmax(0,1fr)] md:items-center">
                  <div className="rounded-[20px] border border-white/10 bg-white/6 p-3">
                    <div className="relative aspect-[16/11] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#f8f1e9,#fefbf8)]">
                      <Image
                        src={CHARACTER_SHEET_PREVIEW_URL}
                        alt="Turnaround-style character reference ready to be reused in later stages."
                        fill
                        sizes="420px"
                        className="object-contain p-4"
                      />
                    </div>
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 text-slate-300" />
                  <div className="rounded-[20px] border border-white/10 bg-white/6 p-3">
                    <div className="relative aspect-[16/11] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.36),rgba(76,132,255,0.18))]">
                      <Image
                        src={PORTRAIT_REFERENCE_PREVIEW_URL}
                        alt="First-frame visual prepared from the same consistent character reference."
                        fill
                        sizes="360px"
                        className="object-cover object-center opacity-85"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#08111c] via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                        <span>Motion-ready still</span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start">
            <div className="stack-gap-lg">
              <SectionHeader
                eyebrow="Benefits"
                title="Why Creators Use It"
                body={
                  <p>
                    This workflow is built to reduce avoidable regeneration and give you a cleaner starting point for the rest of
                    the stack.
                  </p>
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                {BENEFITS.map((benefit, index) => (
                  <Card
                    key={benefit.title}
                    className="border-hairline bg-bg/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <Sparkles className="h-4 w-4 text-brand" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">{benefit.body}</p>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,242,236,0.96))] p-0">
              <div className="border-b border-hairline px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Who it is for</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                  Creator workflow and commercial workflow, both early in the pipeline
                </h3>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-hairline p-6 sm:border-b-0 sm:border-r">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Creator / story</p>
                  <h4 className="mt-3 text-xl font-semibold text-text-primary">Short films and scene continuity</h4>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    Lock your lead character once, then reuse the same reference pack as you test new scenes, moods, and shot plans.
                  </p>
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Commercial / agency</p>
                  <h4 className="mt-3 text-xl font-semibold text-text-primary">Recurring talent and ad variations</h4>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    Keep spokespersons, mascots, or recurring characters aligned while you branch into multiple campaign versions.
                  </p>
                </div>
              </div>
                <div className="border-t border-hairline p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-[#f7f1ea]">
                    <Image
                      src={CHARACTER_SHEET_PREVIEW_URL}
                      alt="Reusable character sheet used for creator and commercial workflows."
                      fill
                      sizes="260px"
                      className="object-contain p-4"
                    />
                  </div>
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-[#f7f1ea]">
                    <Image
                      src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                      alt="Character Builder workspace screenshot used as part of the reusable asset workflow."
                      fill
                      sizes="420px"
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-[#09111c] section text-white">
        <div className="container-page max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="stack-gap-lg">
              <SectionHeader
                eyebrow="Workflow"
                title="Use Character References Before Image-to-Video"
                light
                body={
                  <>
                    <p>
                      Create a clean reference first, then bring it into your preferred image-to-video workflow. This makes it
                      easier to keep facial traits, outfits, and proportions stable across clips.
                    </p>
                    <p>
                      You can generate the reference in the builder, refine it in{' '}
                      <Link href="/app/image" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                        Image
                      </Link>
                      , then move into{' '}
                      <Link href="/app" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                        Video
                      </Link>{' '}
                      with a stronger first frame and a cleaner visual brief.
                    </p>
                  </>
                }
              />
              <div className="flex flex-wrap gap-3">
                {WORKFLOW_LINKS.map((link) => (
                  <LinkChip key={link.href} href={link.href} label={link.label} dark />
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-white/10 bg-white/5 p-5 shadow-[0_32px_90px_rgba(0,0,0,0.25)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                <span>Reference pipeline</span>
                <span>Character Builder → Image → Video</span>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.86fr)_auto_minmax(0,0.86fr)_auto_minmax(0,0.96fr)] md:items-center">
                {[
                  { title: 'Character Builder', body: 'Create the reusable sheet or portrait anchor.' },
                  { title: 'Image', body: 'Refine the chosen still without rebuilding identity.' },
                  { title: 'Video', body: 'Launch motion from a stronger first frame.' },
                ].map((item, index) => (
                  <div key={item.title} className="contents">
                    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white">{item.body}</p>
                    </div>
                    {index < 2 ? <ArrowRight className="mx-auto hidden h-5 w-5 text-slate-400 md:block" /> : null}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                  <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[#dfe8f4]">
                      <Image
                        src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                        alt="Character Builder workspace showing the reference before image-to-video."
                        fill
                        sizes="220px"
                        className="object-cover object-left-top"
                      />
                    </div>
                  </div>
                  <ArrowRight className="mx-auto h-5 w-5 text-slate-300" />
                  <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.36),rgba(76,132,255,0.18))]">
                      <Image
                        src={PORTRAIT_REFERENCE_PREVIEW_URL}
                        alt="Video thumbnail concept based on the same consistent character reference."
                        fill
                        sizes="320px"
                        className="object-cover object-center opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#08111c] via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                        <span>Stable first frame</span>
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Use cases"
            title="Best Use Cases"
            body={
              <p>
                These workflows make sense anywhere you need more reliable assets before you commit budget to generation or
                iteration.
              </p>
            }
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,249,252,0.96))] p-5">
                <div className="grid grid-cols-3 gap-3">
                  <VisualThumb
                    label="Reference"
                    note="Lead preserved"
                    src={PORTRAIT_REFERENCE_PREVIEW_URL}
                    alt="Portrait reference for a recurring lead character."
                    background="bg-[linear-gradient(180deg,#fde1d3,#fff4ed)]"
                  />
                  <VisualThumb
                    label="Sheet"
                    note="Shot planning"
                    src={CHARACTER_SHEET_PREVIEW_URL}
                    alt="Character sheet used to plan multiple scenes."
                    background="bg-[linear-gradient(180deg,#f8f1e9,#fff9f3)]"
                    imageClassName="object-contain p-2"
                  />
                  <VisualThumb
                    label="Tool"
                    note="Iteration view"
                    src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                    alt="Character Builder screenshot crop showing iterative controls."
                    background="bg-[linear-gradient(180deg,#dce8ff,#f7fbff)]"
                    imageClassName="object-cover object-top"
                  />
                </div>
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Creator / story</p>
                <h3 className="text-xl font-semibold text-text-primary">Short films and story scenes</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Keep leads and recurring characters readable from shot to shot before you animate or cut sequences.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(250,244,239,0.96))] p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-[#dfe8f4]">
                    <Image
                      src={CHARACTER_WORKSPACE_SCREENSHOT_PATH}
                      alt="Character Builder workspace used to prepare recurring ad talent references."
                      fill
                      sizes="220px"
                      className="object-cover object-left-top"
                    />
                  </div>
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-[#f7f1ea]">
                    <Image
                      src={CHARACTER_SHEET_PREVIEW_URL}
                      alt="Character sheet used for ad variations and branded content."
                      fill
                      sizes="340px"
                      className="object-contain p-4"
                    />
                  </div>
                </div>
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Commercial / agency</p>
                <h3 className="text-xl font-semibold text-text-primary">AI ad creatives with recurring talent</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Anchor the same character or spokesperson before you branch into multiple campaign variants.
                </p>
              </div>
            </Card>

            {[
              {
                title: 'YouTube and social series',
                body: 'Build one reference asset for an ongoing format instead of re-solving identity every episode.',
              },
              {
                title: 'Brand mascots',
                body: 'Create a repeatable mascot reference that can survive changing prompts, scenes, and output styles.',
              },
              {
                title: 'Comics and animation previsualization',
                body: 'Use turnaround-style sheets and stable portraits to support boards, panels, and scene planning.',
              },
            ].map((useCase) => (
              <Card key={useCase.title} className="border-hairline bg-surface p-5 lg:col-span-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Reusable asset workflow</p>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{useCase.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-4xl stack-gap-lg">
          <SectionHeader
            eyebrow="FAQ"
            title="Consistent Character AI FAQ"
            body={
              <p>
                Short answers to the questions people ask before they start building a reusable image-to-video pipeline.
              </p>
            }
          />
          <div className="stack-gap-sm">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="rounded-[24px] border border-hairline bg-bg/80 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-text-primary">{faq.question}</summary>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section halo-workspace-bottom">
        <div className="container-page max-w-6xl">
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(31,55,82,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Final CTA</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Build Your Character Reference</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>
                    Create reusable character references before you generate. Turn one image into a reusable character sheet, keep
                    the same character across scenes, prompts, and video workflows, and connect it back to the rest of MaxVideoAI.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/app/tools/character-builder" size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                    Open Character Builder
                  </ButtonLink>
                  <ButtonLink href="/tools" variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                    Browse Tools
                  </ButtonLink>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <span>Reusable output</span>
                  <span>Character pack</span>
                </div>
                <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f8f1e9,#fefbf8)]">
                  <Image
                    src={CHARACTER_SHEET_PREVIEW_URL}
                    alt="Consistent character sheet preview used in the final call to action."
                    fill
                    sizes="420px"
                    className="object-contain p-4"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <FAQSchema questions={FAQS.slice(0, 6)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </>
  );
}
