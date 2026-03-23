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
const ANGLE_WORKSPACE_HERO_PATH = '/assets/tools/angle-workspace.png?hero=1';
const ANGLE_WORKSPACE_SCREENSHOT_PATH = '/assets/tools/angle-workspace.png';

const PROOF_BULLETS = [
  'Generate new viewpoints from one image',
  'Explore rotate, tilt, and zoom style changes',
  'Create better first frames for image-to-video',
] as const;

const STEPS = [
  {
    title: 'Upload an image',
    body: 'Start from the frame, product shot, scene still, or character image that already has the right subject.',
  },
  {
    title: 'Adjust angle or perspective controls',
    body: 'Use rotation, tilt, zoom, and the angle picker to test stronger framing without rebuilding the scene.',
  },
  {
    title: 'Generate a new first frame or alternate viewpoint',
    body: 'Keep the angle that works, then carry it into image edits, storyboards, ads, or motion generation in MaxVideoAI.',
  },
] as const;

const BENEFITS = [
  {
    title: 'Explore compositions faster',
    body: 'You can test viewpoint and framing without paying the full cost of rebuilding a scene from scratch.',
  },
  {
    title: 'Avoid unnecessary re-generation',
    body: 'When the subject already works, perspective control lets you salvage the useful frame instead of throwing it away.',
  },
  {
    title: 'Improve first-frame quality',
    body: 'A better angle gives downstream image-to-video tools a clearer starting point and less visual ambiguity.',
  },
  {
    title: 'Test angles for ads, products, and story scenes',
    body: 'The same workflow supports product creative, social campaigns, storyboarding, and character scene setup.',
  },
] as const;

const WORKFLOW_LINKS = [
  { href: '/app/image', label: 'Open Image Workspace' },
  { href: '/app', label: 'Open Video Workspace' },
  { href: '/models/veo-3-1', label: 'Veo 3.1' },
  { href: '/models/kling-3-pro', label: 'Kling 3 Pro' },
  { href: '/models', label: 'Browse Model Hub' },
  { href: '/examples', label: 'See Examples' },
] as const;

const FAQS = [
  {
    question: 'Can AI change the camera angle of a photo?',
    answer:
      'Yes. AI can generate alternate viewpoints from one source image so you can explore framing and perspective without rebuilding the whole image from zero.',
  },
  {
    question: 'What is the difference between camera angle and image perspective?',
    answer:
      'Camera angle usually refers to where the camera sits relative to the subject, while perspective is the broader sense of depth and spatial viewpoint. In practice, both affect whether the frame is usable.',
  },
  {
    question: 'Can I use this for product photos?',
    answer:
      'Yes. Product and ecommerce teams can turn one source image into alternate packshot-style views, side angles, or stronger hero frames.',
  },
  {
    question: 'Does this help before image-to-video generation?',
    answer:
      'Yes. A better angle gives your video workflow a cleaner starting frame, which helps the next step understand composition, subject placement, and visual priority.',
  },
  {
    question: 'Can I generate multiple angles from one image?',
    answer:
      'Yes. The workflow is built to explore more than one usable viewpoint from a single source image so you can compare options before moving forward.',
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
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
      <div className={`relative aspect-[4/3] ${background}`}>
        <Image src={src} alt={alt} fill sizes="180px" className={imageClassName} />
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">{label}</p>
        <p className="text-xs leading-5 text-slate-300">{note}</p>
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
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Front angle</div>
        </div>
        <ArrowRight className="mx-auto h-4 w-4 text-brand" />
        <div className="rounded-[18px] border border-hairline bg-white p-4">
          <div className="mx-auto h-28 w-20 origin-bottom-left rotate-[-12deg] rounded-[22px] bg-[linear-gradient(180deg,#1d4ed8,#0f172a)] shadow-[24px_0_32px_rgba(15,23,42,0.16)]" />
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">3/4 product view</div>
        </div>
      </div>
    </div>
  );
}

function HeroScreenshotPreview() {
  const callouts = [
    {
      label: '01',
      title: 'Start from one image',
      body: 'Keep the subject you already like instead of rebuilding the scene from scratch.',
    },
    {
      label: '02',
      title: 'Adjust angle controls',
      body: 'Use the angle picker plus rotation, tilt, and zoom to explore perspective fast.',
    },
    {
      label: '03',
      title: 'Pick a stronger first frame',
      body: 'Move the chosen view into image edits or image-to-video with a cleaner starting point.',
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-t-[34px] rounded-b-[30px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>Actual tool screenshot</span>
        <span>Angle workspace</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              source image, angle picker, first frame preview
            </span>
          </div>
          <div className="relative aspect-[16/9]">
            <Image
              src={ANGLE_WORKSPACE_HERO_PATH}
              alt="Full screenshot of the MaxVideoAI Angle workspace."
              fill
              priority
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-[center_18%]"
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
      'Upload one image, change camera angle, and generate new perspectives with AI to build better first frames for image-to-video, storyboards, ads, and product shots.',
    featureList: [
      'Generate new viewpoints from one image',
      'Explore rotation, tilt, and zoom style changes',
      'Create better first frames for image-to-video',
      'Use one source image to compare multiple usable camera angles',
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
    description: 'Generate alternate camera angles from one image before moving into image-to-video.',
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
              <span className="font-semibold text-text-secondary">Change Camera Angle with AI</span>
            </nav>

            <div className="stack-gap-sm">
              <div className="inline-flex w-fit items-center rounded-full border border-hairline bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted shadow-card">
                Angle / Perspective
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f5d7a] sm:text-xs">
                Build better first frames before image-to-video.
              </p>
            </div>

            <div className="stack-gap-sm">
              <h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[4rem] lg:leading-[1.02]">
                Change Camera Angle with AI
              </h1>
              <p className="max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
                Generate new viewpoints from a single image, explore perspective quickly, and create stronger first frames for
                image-to-video workflows.
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
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">One Good Image Often Starts From the Wrong Angle</h2>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-slate-300">
                <p>
                  Sometimes the subject is right, but the viewpoint is wrong. Rebuilding the entire image from scratch wastes time
                  and weakens consistency.
                </p>
                <p>
                  That problem shows up in ads, product shots, storyboards, and first-frame planning. The content is close, but the
                  framing, perspective, or camera height is not ready for the next step.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    'The subject works, but framing feels flat',
                    'Perspective is wrong for the storyboard',
                    'Product shots need more commercial angles',
                    'Video first frames start from weak composition',
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
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                  Generate New Perspectives Without Rebuilding Everything
                </h2>
              </div>
              <div className="stack-gap-sm px-6 py-6 text-sm leading-7 text-text-secondary">
                <p>
                  Angle / Perspective helps you change camera viewpoint from a source image so you can test framing, composition,
                  and perspective before moving into image-to-video.
                </p>
                <p>
                  Instead of regenerating the whole scene, you keep the image you already like and push it toward a better camera
                  angle or motion-ready first frame.
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
                    Start from a usable frame, adjust the viewpoint, then reuse the stronger angle in the rest of the workflow.
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
                      Find the better angle before you branch into generation
                    </h3>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    source → angle picker → output
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
                      maxvideoai / angle
                    </span>
                  </div>
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
                      alt="Angle workspace screenshot inside MaxVideoAI."
                      fill
                      sizes="(max-width: 1280px) 100vw, 620px"
                      className="object-cover object-top bg-[#f6f9fc]"
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {['Source image', 'Angle controls', 'First frame preview'].map((item) => (
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
            title="Explore More Than One View"
            body={
              <p>
                Use these outputs as reusable first-frame assets before you move into prompt variations, image edits, or motion
                generation.
              </p>
            }
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <OutputCard
              eyebrow="Composition test"
              title="Eye-level to low-angle"
              body="Shift from a flat eye-level frame toward a stronger low-angle view when you want more scale, tension, or authority."
              className="lg:col-span-7"
              visual={
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                    <Image src={ANGLE_SOURCE_URL} alt="Eye-level source image." fill sizes="360px" className="object-cover" />
                  </div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                    <Image src={ANGLE_OUTPUT_URL} alt="Low-angle output generated from the same image." fill sizes="360px" className="object-cover" />
                  </div>
                </div>
              }
            />
            <OutputCard
              eyebrow="Portrait staging"
              title="Portrait to 3/4 view"
              body="Create a more usable portrait or story frame from one reference instead of prompting the whole scene again."
              className="lg:col-span-5"
              visual={
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#edf3f8]">
                    <Image src={ANGLE_SOURCE_URL} alt="Original portrait angle." fill sizes="260px" className="object-cover" />
                  </div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e8f0f8]">
                    <Image src={ANGLE_ALT_THREE_URL} alt="Three-quarter portrait view generated from the same source." fill sizes="260px" className="object-cover" />
                  </div>
                </div>
              }
            />
            <OutputCard
              eyebrow="Angle set"
              title="Multiple usable viewpoints from one image"
              body="Compare several angles quickly so you can choose the one that fits the scene, storyboard, or commercial use case best."
              className="lg:col-span-5"
              visual={
                <div className="grid grid-cols-2 gap-3">
                  <AngleThumb
                    label="Source"
                    note="Original frame"
                    src={ANGLE_SOURCE_URL}
                    alt="Source image before angle changes."
                    background="bg-[#edf3f8]"
                  />
                  <AngleThumb
                    label="Low"
                    note="More scale"
                    src={ANGLE_OUTPUT_URL}
                    alt="Low-angle output."
                    background="bg-[#e8f0f8]"
                  />
                  <AngleThumb
                    label="3/4"
                    note="Story framing"
                    src={ANGLE_ALT_THREE_URL}
                    alt="Three-quarter view output."
                    background="bg-[#e8f0f8]"
                  />
                  <AngleThumb
                    label="High"
                    note="Overhead feel"
                    src={ANGLE_ALT_FOUR_URL}
                    alt="Higher perspective output."
                    background="bg-[#e8f0f8]"
                  />
                </div>
              }
            />
            <OutputCard
              eyebrow="Ecommerce"
              title="Product front to side angle"
              body="Use perspective changes to turn one usable product image into more commercial-ready product angles for listings, ads, or launch pages."
              className="lg:col-span-7"
              dark
              visual={<ProductAngleMock />}
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
                title="Why It Matters"
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
                    <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">{benefit.body}</p>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,252,0.96))] p-0">
              <div className="border-b border-hairline px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Who it is for</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                  Creator workflow and commercial workflow, both before motion
                </h3>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-hairline p-6 sm:border-b-0 sm:border-r">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Creator / story</p>
                  <h4 className="mt-3 text-xl font-semibold text-text-primary">Storyboards and scene setup</h4>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    Find a more readable angle before you commit a scene to boards, edits, or image-to-video motion.
                  </p>
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Commercial / agency</p>
                  <h4 className="mt-3 text-xl font-semibold text-text-primary">Product and ad angle testing</h4>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    Turn one approved image into more commercial viewpoints without rebuilding the campaign concept.
                  </p>
                </div>
              </div>
              <div className="border-t border-hairline p-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#e8f0f8]">
                    <Image
                      src={ANGLE_ALT_THREE_URL}
                      alt="Alternate story angle generated from one source image."
                      fill
                      sizes="260px"
                      className="object-cover"
                    />
                  </div>
                  <div className="rounded-[22px] border border-hairline bg-white p-3">
                    <ProductAngleMock />
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
                title="Prepare a Better First Frame for Image-to-Video"
                light
                body={
                  <>
                    <p>
                      A stronger first frame gives your video workflow a clearer visual starting point. Use a cleaned-up angle or
                      perspective before launching motion generation.
                    </p>
                    <p>
                      You can refine the image in{' '}
                      <Link href="/app/image" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                        Image
                      </Link>
                      , then launch motion in{' '}
                      <Link href="/app" className="font-semibold text-white underline decoration-white/30 underline-offset-4">
                        Video
                      </Link>{' '}
                      once the first frame is doing more of the work.
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
                <span>Angle pipeline</span>
                <span>Source → Angle → Image / Video</span>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.86fr)_auto_minmax(0,0.86fr)_auto_minmax(0,0.96fr)] md:items-center">
                {[
                  { title: 'Source', body: 'Start from the frame you already trust.' },
                  { title: 'Angle', body: 'Pick the better viewpoint before you continue.' },
                  { title: 'Image / Video', body: 'Launch from a stronger first frame.' },
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
                These workflows make sense anywhere you need more reliable first-frame assets before you commit budget to generation
                or iteration.
              </p>
            }
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,249,252,0.96))] p-5">
                <div className="grid grid-cols-3 gap-3">
                  <AngleThumb
                    label="Source"
                    note="Scene still"
                    src={ANGLE_SOURCE_URL}
                    alt="Original scene still for storyboarding."
                    background="bg-[#edf3f8]"
                  />
                  <AngleThumb
                    label="3/4"
                    note="Story frame"
                    src={ANGLE_ALT_THREE_URL}
                    alt="Alternative story frame."
                    background="bg-[#e8f0f8]"
                  />
                  <AngleThumb
                    label="Tool"
                    note="Angle review"
                    src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
                    alt="Angle workspace screenshot showing the first-frame workflow."
                    background="bg-[#dce8ff]"
                    imageClassName="object-cover object-top"
                  />
                </div>
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Creator / story</p>
                <h3 className="text-xl font-semibold text-text-primary">Storyboarding and previsualization</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Test perspective before you commit to a sequence, a board, or an animatic.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border-hairline bg-surface p-0 lg:col-span-6">
              <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(241,247,252,0.96))] p-5">
                <ProductAngleMock />
              </div>
              <div className="stack-gap-sm p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Commercial / agency</p>
                <h3 className="text-xl font-semibold text-text-primary">Product and ecommerce shots</h3>
                <p className="text-sm leading-7 text-text-secondary">
                  Turn one clean product image into multiple usable angles for listings, ads, or launch pages.
                </p>
              </div>
            </Card>

            {[
              {
                title: 'Social content',
                body: 'Quickly build alternate viewpoints for vertical edits, thumbnails, and platform-specific variants.',
              },
              {
                title: 'Ad creative testing',
                body: 'Swap camera perspective without rebuilding the whole concept when you need more versions fast.',
              },
              {
                title: 'Character scene setup',
                body: 'Find a stronger first frame for a scene before you move that subject into image-to-video.',
              },
            ].map((useCase) => (
              <Card key={useCase.title} className="border-hairline bg-surface p-5 lg:col-span-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Reusable angle workflow</p>
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
            title="Camera Angle AI FAQ"
            body={
              <p>
                Short answers to the questions people ask before they start building a cleaner first-frame workflow.
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
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(20,48,76,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Final CTA</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Generate a Better Camera Angle</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>
                    Change the viewpoint without redoing the whole image. Turn one image into multiple usable camera angles, choose
                    the strongest first frame, and connect it back to the rest of MaxVideoAI.
                  </p>
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
                  <span>Chosen angle</span>
                  <span>First frame</span>
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

      <FAQSchema questions={FAQS.slice(0, 6)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(howToJsonLd) }} />
    </>
  );
}
