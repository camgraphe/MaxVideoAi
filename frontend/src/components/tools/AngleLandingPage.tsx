import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, Play } from 'lucide-react';
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

const STEPS = [
  {
    title: 'Upload one image',
    body: 'Start from the frame, product shot, or scene still that already has the right subject.',
  },
  {
    title: 'Pick the viewpoint',
    body: 'Use the angle picker plus rotation, tilt, and zoom to test cleaner framing fast.',
  },
  {
    title: 'Generate and continue',
    body: 'Keep the angle that works, then move it into image edits, storyboards, ads, or video prep.',
  },
] as const;

const BENEFITS = [
  {
    title: 'Less rework',
    body: 'Fix the viewpoint without throwing away a source image that is already close.',
  },
  {
    title: 'Faster shot selection',
    body: 'Compare alternate angles before you spend more time or budget on full regeneration.',
  },
  {
    title: 'Better image-to-video prep',
    body: 'A cleaner first frame gives motion tools a clearer composition to build from.',
  },
  {
    title: 'More coverage from one asset',
    body: 'Get extra product, portrait, or scene views from a single source image.',
  },
] as const;

const WORKSPACE_CALLOUTS = [
  {
    title: 'Source image',
    body: 'Start from the frame you already trust.',
  },
  {
    title: 'Angle controls',
    body: 'Adjust the angle picker, rotation, tilt, and zoom in one pass.',
  },
  {
    title: 'Output review',
    body: 'Compare results before sending one into Image or Video.',
  },
] as const;

const PIPELINE_STEPS = [
  {
    title: 'Source image',
    body: 'Start from the frame or product shot that already works.',
  },
  {
    title: 'Selected angle',
    body: 'Keep the version that fixes composition or camera height.',
  },
  {
    title: 'Image / Video',
    body: 'Refine it in Image or use it as the first frame before motion.',
  },
] as const;

const WORKFLOW_LINKS = [
  { href: '/app/image', label: 'Open Image Workspace' },
  { href: '/app', label: 'Open Video Workspace' },
  { href: '/models/veo-3-1', label: 'Veo 3.1' },
  { href: '/models/kling-3-pro', label: 'Kling 3 Pro' },
  { href: '/models', label: 'Model Hub' },
] as const;

const SMALL_USE_CASES = [
  {
    eyebrow: 'Ad / creative',
    title: 'Ad creative testing',
    body: 'Test alternate camera views without rebuilding the whole concept.',
  },
  {
    eyebrow: 'Character / scene',
    title: 'Character scene setup',
    body: 'Choose a more readable frame before still edits or image-to-video.',
  },
] as const;

const FAQS = [
  {
    question: 'Can AI change the camera angle of a photo?',
    answer: 'Yes. You can generate alternate viewpoints from one source image instead of rebuilding the whole scene.',
  },
  {
    question: 'What goes in and what comes out?',
    answer: 'You start with one image and generate one or more alternate views from it, ready for comparison or reuse.',
  },
  {
    question: 'Does this help before image-to-video generation?',
    answer: 'Yes. It helps you choose a better starting frame before you move into motion.',
  },
  {
    question: 'Can I use this for product photos?',
    answer: 'Yes. It works well for packshots, side angles, and stronger hero views from one product image.',
  },
  {
    question: 'Can I generate multiple angles from one image?',
    answer: 'Yes. You can generate several views, compare them, and keep the one that fits the next step best.',
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

function ProductAngleMock() {
  return (
    <div className="rounded-[22px] border border-hairline bg-[linear-gradient(180deg,#f5f8fb,#ffffff)] p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="rounded-[18px] border border-hairline bg-white p-4">
          <div className="mx-auto h-28 w-20 rounded-[22px] bg-[linear-gradient(180deg,#334155,#0f172a)] shadow-[0_18px_26px_rgba(15,23,42,0.14)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Straight-on packshot
          </div>
        </div>
        <ArrowRight className="mx-auto h-4 w-4 text-brand" />
        <div className="rounded-[18px] border border-hairline bg-white p-4">
          <div className="mx-auto h-28 w-20 origin-bottom-left rotate-[-12deg] rounded-[22px] bg-[linear-gradient(180deg,#1d4ed8,#0f172a)] shadow-[24px_0_32px_rgba(15,23,42,0.16)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Three-quarter hero view
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroAngleFlowPanel() {
  return (
    <div className="overflow-hidden rounded-[36px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_42px_140px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-7">
        <span>Source → Angle → Output</span>
        <span>Keep the image, shift the viewpoint</span>
      </div>
      <div className="grid gap-5 p-6 sm:p-7 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.08fr)] lg:items-center">
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Source image</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#dce7f3]">
              <Image
                src={ANGLE_SOURCE_URL}
                alt="Source image before changing the camera angle."
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
              {[
                ['Rotation', 'Shift left / right'],
                ['Tilt', 'Raise / lower camera'],
                ['Zoom', 'Tighten framing'],
              ].map(([item, note]) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-3 text-center"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{item}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Selected output</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#d9e6f3]">
              <Image
                src={ANGLE_OUTPUT_URL}
                alt="Alternate camera angle generated from the same source image."
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            'Start from one usable image',
            'Change the camera angle, not the whole concept',
            'Keep the chosen frame before image-to-video',
          ].map((item) => (
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

function WorkspaceShowcase() {
  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>Angle workspace</span>
        <span>Source image + controls + outputs</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              source image, angle picker, output review
            </span>
          </div>
          <div className="relative aspect-[16/9]">
            <Image
              src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
              alt="Full screenshot of the MaxVideoAI Angle workspace."
              fill
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {WORKSPACE_CALLOUTS.map((item) => (
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

export function AngleLandingPage() {
  const canonicalUrl = 'https://maxvideoai.com/tools/angle';
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
        name: 'Change Camera Angle with AI',
        item: canonicalUrl,
      },
    ],
  };
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    name: 'Change Camera Angle with AI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonicalUrl,
    description:
      'Upload one image, change camera angle without rebuilding the scene, and generate better first frames for image-to-video, storyboards, ads, and product shots.',
    featureList: [
      'Change camera angle from one source image',
      'Adjust rotation, tilt, and zoom',
      'Compare multiple alternate views',
      'Use the selected frame before image-to-video',
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
    description: 'Change camera angle from one image before moving into image-to-video.',
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
      <section className="relative overflow-hidden border-b border-hairline bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_28%),radial-gradient(circle_at_right,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))]">
        <div className="container-page relative max-w-7xl py-8 sm:py-10 lg:py-12">
          <div className="stack-gap-lg">
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
                <span className="font-semibold text-text-secondary">Change Camera Angle with AI</span>
              </nav>

              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f5d7a] sm:text-xs">
                  One image in. New camera angle out.
                </p>
              </div>

              <div className="stack-gap-sm">
                <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[4.25rem] lg:leading-[0.98]">
                  Change Camera Angle Without Rebuilding the Image
                </h1>
                <p className="max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
                  Generate alternate viewpoints from a single shot and keep the best result as your first frame before
                  image-to-video.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/app/tools/angle" size="lg">
                  Open Tool
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="/examples" variant="outline" size="lg">
                  View Angle Examples
                </ButtonLink>
              </div>
            </div>

            <div className="mt-2 sm:mt-4">
              <p className="mb-4 text-sm font-medium text-text-secondary">
                Best when the subject is already right and only the viewpoint needs to change.
              </p>
            </div>

            <HeroAngleFlowPanel />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Problem + solution"
            title="One good image often starts from the wrong angle"
            body={
              <p>
                When the subject is already right, the faster move is to fix the viewpoint instead of regenerating the whole image.
              </p>
            }
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-0 text-white">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Problem</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">The asset is close, but the shot is wrong</h3>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-slate-300">
                <p>
                  The subject works, but camera height, framing, or perspective does not. Rebuilding from scratch costs time and
                  risks consistency.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'The subject is right, but the framing feels flat',
                    'The storyboard needs a different camera height',
                    'The product needs a more commercial view',
                    'The opening video frame lacks direction',
                  ].map((item) => (
                    <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-sm font-medium text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,252,0.98))] p-0">
              <div className="border-b border-hairline px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Solution</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Change the viewpoint and keep moving</h3>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-text-secondary">
                <p>
                  Angle lets you keep the source image you already trust, generate a new camera angle, and continue with the version
                  that fits the next step.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#edf3f8]">
                      <Image
                        src={ANGLE_SOURCE_URL}
                        alt="Source image used before generating alternate camera angles."
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
                        alt="Alternate low-angle view generated from the same source image."
                        fill
                        sizes="360px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-text-primary">
                  Use the better angle as a still, or take it straight into image-to-video.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="How it works"
            title="Upload, aim, generate"
            body={
              <p>
                Three steps: bring in a usable image, steer the viewpoint, and keep the version that belongs in the next step.
              </p>
            }
          />

          <div className="grid gap-4 md:grid-cols-3">
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
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Workspace"
            title="Everything important sits in one view"
            body={
              <p>
                The source image, angle controls, and outputs stay side by side so you can compare fast and pick the frame you want.
              </p>
            }
          />
          <WorkspaceShowcase />
        </div>
      </section>

      <section className="border-t border-hairline bg-[#09111c] section text-white">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Outputs + pipeline"
            title="Choose the angle, then move it into the next step"
            light
            body={
              <p>
                Generate one cleaner view or compare several. Once you have the frame you want, refine it in Image or use it before
                image-to-video.
              </p>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start">
            <div className="grid gap-4 md:grid-cols-2">
              <OutputCard
                eyebrow="Composition shift"
                title="Eye-level to low-angle"
                body="Move a flat frame toward a more dramatic view when the subject needs more scale or authority."
                visual={
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                      <Image src={ANGLE_SOURCE_URL} alt="Eye-level source image." fill sizes="320px" className="object-cover" />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                      <Image
                        src={ANGLE_OUTPUT_URL}
                        alt="Low-angle output generated from the same image."
                        fill
                        sizes="320px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                }
              />
              <OutputCard
                eyebrow="Portrait framing"
                title="Straight-on to three-quarter"
                body="Turn a plain reference into a more usable story or ad frame from the same source image."
                visual={
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                      <Image src={ANGLE_SOURCE_URL} alt="Original portrait angle." fill sizes="260px" className="object-cover" />
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                      <Image
                        src={ANGLE_ALT_THREE_URL}
                        alt="Three-quarter portrait view generated from the same source."
                        fill
                        sizes="260px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                }
              />
              <OutputCard
                eyebrow="Angle set"
                title="Compare several views from one image"
                body="Generate a small set when you need to choose the option that best fits storyboards, product pages, or motion prep."
                className="md:col-span-2"
                visual={
                  <div className="grid grid-cols-2 gap-3">
                    <AngleThumb
                      label="Original"
                      note="Base frame"
                      src={ANGLE_SOURCE_URL}
                      alt="Source image before angle changes."
                      background="bg-[#edf3f8]"
                    />
                    <AngleThumb
                      label="Low angle"
                      note="More scale"
                      src={ANGLE_OUTPUT_URL}
                      alt="Low-angle output."
                      background="bg-[#e8f0f8]"
                    />
                    <AngleThumb
                      label="Three-quarter"
                      note="Story framing"
                      src={ANGLE_ALT_THREE_URL}
                      alt="Three-quarter view output."
                      background="bg-[#e8f0f8]"
                    />
                    <AngleThumb
                      label="High angle"
                      note="Top-down feel"
                      src={ANGLE_ALT_FOUR_URL}
                      alt="Higher perspective output."
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Angle pipeline</p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">Source → Angle → Image / Video</h3>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    First-frame prep
                  </div>
                </div>
              </div>

              <div className="stack-gap-lg p-6">
                <div className="stack-gap-sm">
                  {PIPELINE_STEPS.map((item, index) => (
                    <div key={item.title} className="stack-gap-sm">
                      <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white">{item.body}</p>
                      </div>
                      {index < PIPELINE_STEPS.length - 1 ? (
                        <div className="flex justify-center">
                          <ArrowRight className="h-4 w-4 rotate-90 text-slate-400" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <p className="text-sm leading-7 text-slate-300">
                  Refine the chosen frame in{' '}
                  <Link href="/app/image" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                    Image
                  </Link>{' '}
                  or launch motion in{' '}
                  <Link href="/app" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                    Video
                  </Link>{' '}
                  once the opening composition is working.
                </p>

                <div className="flex flex-wrap gap-3">
                  {WORKFLOW_LINKS.map((link) => (
                    <LinkChip key={link.href} href={link.href} label={link.label} dark />
                  ))}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] sm:items-center">
                    <div className="rounded-[18px] border border-white/10 bg-white/6 p-3">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-[#dbe6f3]">
                        <Image
                          src={ANGLE_OUTPUT_URL}
                          alt="Selected alternate angle used before video generation."
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
                          alt="Video thumbnail concept based on the chosen camera angle."
                          fill
                          sizes="320px"
                          className="object-cover opacity-85"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#08111c] via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          <span>Ready for motion</span>
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
          <SectionHeader
            eyebrow="Benefits"
            title="Why it matters"
            body={<p>This is a focused fix for viewpoint problems, which makes the next creative decision faster.</p>}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BENEFITS.map((benefit, index) => (
              <Card
                key={benefit.title}
                className="border-hairline bg-surface p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)]"
              >
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
          <SectionHeader
            eyebrow="Use cases"
            title="Where it fits best"
            body={
              <p>Best when the asset is nearly right and the next decision depends on camera angle, not on rebuilding the scene.</p>
            }
          />

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="overflow-hidden border-hairline bg-bg p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,249,252,0.96))] p-5">
                <div className="grid grid-cols-3 gap-3">
                  <AngleThumb
                    label="Original"
                    note="Scene still"
                    src={ANGLE_SOURCE_URL}
                    alt="Original scene still for storyboarding."
                    background="bg-[#edf3f8]"
                  />
                  <AngleThumb
                    label="Three-quarter"
                    note="Board-ready frame"
                    src={ANGLE_ALT_THREE_URL}
                    alt="Alternative story frame."
                    background="bg-[#e8f0f8]"
                  />
                  <AngleThumb
                    label="Workspace"
                    note="Review pass"
                    src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
                    alt="Angle workspace screenshot showing the first-frame workflow."
                    background="bg-[#dce8ff]"
                    imageClassName="object-cover object-top"
                  />
                </div>
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Story / film</p>
                <h3 className="text-xl font-semibold text-text-primary">Storyboarding and previs</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Test perspective before you commit a shot to boards, edits, or an animatic.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-bg p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(241,247,252,0.96))] p-5">
                <ProductAngleMock />
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Commerce</p>
                <h3 className="text-xl font-semibold text-text-primary">Product and ecommerce shots</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Turn one clean product image into multiple usable angles for listings, ads, or launch pages.
                </p>
              </div>
            </Card>

            {SMALL_USE_CASES.map((useCase) => (
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
          <SectionHeader eyebrow="FAQ" title="Camera Angle FAQ" body={<p>Short answers before you start.</p>} />
          <div className="stack-gap-sm">
            {FAQS.map((faq) => (
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Final CTA</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Change the camera angle before you generate more</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>Start with one usable image, create alternate views, and carry the best frame into Image or Video.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/app/tools/angle" size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                    Open Angle Tool
                  </ButtonLink>
                  <ButtonLink href="/tools" variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                    Browse Tools
                  </ButtonLink>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <span>Selected angle</span>
                  <span>Ready for next step</span>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#dce7f3]">
                  <Image
                    src={ANGLE_OUTPUT_URL}
                    alt="Selected alternate camera angle used in the final call to action."
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

      <FAQSchema questions={[...FAQS]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </>
  );
}
