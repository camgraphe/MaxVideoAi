import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const CREATOR_PORTRAIT_URL =
  'https://v3b.fal.media/files/b/0a931e48/bWz0ERHaJHWLDAUDrwFOU_7FrMKKm3.png';
const REFERENCE_ASSET_PORTRAIT_URL =
  'https://v3b.fal.media/files/b/0a9354bf/6jswQE7mDfBZzcMI6j1hD_AQ2sXgYY.png';

const LATEST_CHARACTER_SHEET_ASSETS = [
  {
    url: 'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
    alt: 'Recent Character Builder character sheet render showing four full-body angles and four matching close-ups.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352f9/DfeXOJDDOofcJnA_koAKi_ebpLqdWt.png',
    alt: 'Recent coherent character sheet render from MaxVideoAI with multi-angle full-body views and close-ups.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352ee/98KpFe5eSj8ZPHg_DosEg_8ZnLNqP7.png',
    alt: 'Recent MaxVideoAI character sheet render combining four body angles and four close-up identity views.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352e7/vPTrpWNZxJdPCTfIY-wBN_6P7khp0V.png',
    alt: 'Recent reusable character sheet render with stable face, outfit, and silhouette across eight panels.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352df/zD19EGRVnjzWMFdJRAvII_e5rhKPH6.png',
    alt: 'Recent consistent character sheet render ready for Nano Banana and reference-based video workflows.',
  },
  {
    url: 'https://v3b.fal.media/files/b/0a9352d7/hpI44AzthWfRCFVI1krRZ_SkBdr8pi.png',
    alt: 'Recent Character Builder output showing an eight-panel reference sheet with coherent angles and close-ups.',
  },
] as const;

const [LATEST_SHEET_1, LATEST_SHEET_2, LATEST_SHEET_3, LATEST_SHEET_4] = LATEST_CHARACTER_SHEET_ASSETS;

const WORKFLOW_CHARACTER_SHEET_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
  alt: 'Character Builder sheet used as the reusable reference asset across images and video workflows.',
} as const;
const WORKFLOW_NANO_BANANA_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93538e/6K9vhOS91LPzVB5aEP9MV_gKcs9ukw.jpg',
  alt: 'Nano Banana still created from the same character sheet reference.',
} as const;
const WORKFLOW_VIDEO_START_FRAME_ASSET = {
  videoUrl: 'https://v3b.fal.media/files/b/0a93539e/DZA2waBj2_15D3zXsFkw3_9yIv4OrO.mp4',
  url: 'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/355c847c-7866-43b9-af28-85d6a64dfec8.jpg',
  alt: 'Video start frame generated from the Nano Banana still and the same character identity.',
} as const;
const COMICS_PREVIZ_USE_CASE_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93550f/Ikc271a5TYieq_7qBQuVk_4KrRepo5.png',
  alt: 'Reusable character reference prepared for comics panels and animation previz.',
} as const;
const MASCOT_USE_CASE_ASSET = {
  url: 'https://v3b.fal.media/files/b/0a93562e/5o1aO2LCroDg-PWioialv_ujZx2Wou.png',
  alt: 'Brand mascot prepared as a reusable consistent character asset.',
} as const;

const CHARACTER_WORKSPACE_HERO_PATH = '/assets/tools/character-builder-workspace.png?hero=1';
const SHEET_IMAGE_CLASSNAME = 'object-cover object-center scale-[1.08]';

const HERO_PROOF_BULLETS = [
  'Start with one identity photo, optional outfit inspiration, or a scratch-built concept',
  'Generate a reusable portrait anchor or an 8-panel character sheet',
  'Reuse the same character across scenes, prompts, edits, and still-reference video workflows',
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Start with a face, outfit cue, or scratch concept',
    body: 'Use one identity photo, add optional style direction, or start without a source image.',
  },
  {
    title: 'Generate a portrait anchor or 8-panel sheet',
    body: 'Create a tighter face reference or one coherent sheet with four body angles and four close-ups.',
  },
  {
    title: 'Reuse it in stills, edits, and video prep',
    body: 'Bring the same reference into prompts, Nano Banana, and still-reference video tools.',
  },
] as const;

const INPUT_OPTIONS = [
  'One identity photo',
  'Optional outfit or style reference',
  'Scratch-built character concept',
] as const;

const OUTPUT_OPTIONS = [
  'Portrait anchor',
  '8-panel character sheet',
  'Reusable reference asset',
] as const;

const REUSE_OPTIONS = [
  'Image prompts',
  'Image edits',
  'Nano Banana start-frame prep',
  'Video engines that accept still references',
] as const;

const HOW_IT_WORKS_LABELS = ['Start with', 'Generate', 'Reuse in'] as const;
const HOW_IT_WORKS_OPTIONS = [INPUT_OPTIONS, OUTPUT_OPTIONS, REUSE_OPTIONS] as const;

const COMPARISON_COLUMNS = [
  {
    eyebrow: 'Without Character Builder',
    title: 'Every new scene has to rebuild the character',
    tone: 'border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,245,0.96))]',
    badgeTone: 'bg-rose-100 text-rose-700',
    items: [
      'Face, hair, and outfit drift between prompts',
      'You spend more time correcting continuity',
    ],
  },
  {
    eyebrow: 'With Character Builder',
    title: 'One reference keeps the character grounded',
    tone: 'border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,253,245,0.96))]',
    badgeTone: 'bg-emerald-100 text-emerald-700',
    items: [
      'Face, outfit, and silhouette stay aligned',
      'Stills and video prep start from a stronger base',
    ],
  },
] as const;

const OUTPUT_CARDS = [
  {
    eyebrow: 'Portrait anchor',
    title: 'Reusable portrait anchor',
    body: 'Best for close-ups, prompts, and recurring character work.',
    src: 'https://v3b.fal.media/files/b/0a935655/nJlY0mMASmclDhm6ywMDz_0bzxXv5K.png',
    alt: 'Reusable portrait anchor for close-ups, prompts, and recurring character work.',
    visualClassName: 'object-cover object-center',
    visualTone: 'bg-[linear-gradient(180deg,#fff4ec,#ffffff)]',
  },
  {
    eyebrow: 'Character sheet generator',
    title: '8-panel character sheet',
    body: 'Best when one multi-angle reference has to travel across scenes, boards, edits, and video prep.',
    src: 'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/5daf21e0-e99a-42e5-891a-eca3ba162344.webp',
    alt: '8-panel character sheet output generated from Character Builder.',
    visualClassName: SHEET_IMAGE_CLASSNAME,
    visualTone: 'bg-[#f7f1ea]',
  },
  {
    eyebrow: 'Video prep still',
    title: 'Cleaner still for motion prep',
    body: 'Best when the reference needs one cleaner still before motion starts.',
    src: 'https://v3b.fal.media/files/b/0a935643/1_y_Iw3TbDfMgsI9Kggki_XflHpwqR.jpg',
    alt: 'Cleaner still prepared from the same character reference before motion starts.',
    visualClassName: 'object-cover object-center',
    visualTone:
      'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.26),rgba(76,132,255,0.16))]',
  },
] as const;

const WORKFLOW_LINKS = [
  { href: '/app/image', label: 'Open Nano Banana in Image' },
  { href: '/app', label: 'Open Video Workspace' },
  { href: '/models/nano-banana', label: 'Nano Banana' },
  { href: '/models/veo-3-1', label: 'Veo 3.1' },
  { href: '/models/kling-3-pro', label: 'Kling 3 Pro' },
  { href: '/models', label: 'Browse Model Hub' },
  { href: '/examples', label: 'See Examples' },
] as const;

const USE_CASES = [
  {
    eyebrow: 'Story / Film',
    number: '01',
    title: 'Short films and story scenes',
    body: 'Keep the lead recognizable across boards, scene variations, and first-frame planning before motion starts.',
    src: WORKFLOW_VIDEO_START_FRAME_ASSET.url,
    alt: 'Story scene still generated from a reusable character reference.',
    imageClassName: 'object-cover object-center',
    cardClassName: 'border-slate-800 bg-[linear-gradient(135deg,#0b1320,#162235)] text-white shadow-[0_32px_90px_rgba(15,23,42,0.18)]',
    labelClassName: 'border-white/10 bg-white/5 text-slate-200',
    bodyClassName: 'text-slate-300',
  },
  {
    eyebrow: 'Ad / Commercial',
    number: '02',
    title: 'Recurring ad talent',
    body: 'Reuse one spokesperson across campaign stills, alternate concepts, and reference-based video variants.',
    src: REFERENCE_ASSET_PORTRAIT_URL,
    alt: 'Commercial spokesperson portrait prepared as a reusable reference asset.',
    imageClassName: 'object-cover object-[center_18%]',
    cardClassName: 'border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,241,236,0.96))]',
    labelClassName: 'border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    eyebrow: 'Mascot / Brand',
    number: '03',
    title: 'Brand mascots',
    body: 'Keep one mascot stable across launches, promos, stills, and motion tests instead of rebuilding it each time.',
    src: MASCOT_USE_CASE_ASSET.url,
    alt: MASCOT_USE_CASE_ASSET.alt,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName: 'border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,246,238,0.96))]',
    labelClassName: 'border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    eyebrow: 'Series / Creator',
    number: '04',
    title: 'Creator series',
    body: 'Reuse the same host, avatar, or character every episode without losing face, outfit, or silhouette consistency.',
    src: 'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/8b29c715-842e-473c-a0d3-5ce8d6d6857f.webp',
    alt: 'Creator series frame generated from a reusable character reference.',
    imageClassName: 'object-cover object-center',
    cardClassName: 'border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,246,251,0.96))]',
    labelClassName: 'border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    eyebrow: 'Previs / Comics',
    number: '05',
    title: 'Comics and animation previz',
    body: 'Build one reusable character sheet for boards, panels, turnarounds, and previsualization work before animation.',
    src: COMICS_PREVIZ_USE_CASE_ASSET.url,
    alt: COMICS_PREVIZ_USE_CASE_ASSET.alt,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName: 'border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,245,250,0.96))]',
    labelClassName: 'border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
] as const;

const FAQS = [
  {
    question: 'What is consistent character AI?',
    answer:
      'It means building one stable character reference so the same face, outfit, and silhouette hold up better later on.',
  },
  {
    question: 'Can I create a character sheet from one image?',
    answer:
      'Yes. You can start from one image and generate an 8-panel sheet with four full-body angles and four matching close-ups.',
  },
  {
    question: 'Can I use one face reference and one outfit reference?',
    answer:
      'Yes. You can pair one identity reference with a second image for wardrobe or outfit direction.',
  },
  {
    question: 'Can I start from scratch?',
    answer:
      'Yes. You can build a portrait anchor or character sheet from a scratch-built concept when you do not have a source image.',
  },
  {
    question: 'Can I reuse this in image-to-video workflows?',
    answer:
      'Yes. You can reuse it in prompts, Nano Banana start-frame prep, and video engines that support still references.',
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
      <div
        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
          light
            ? 'border-white/12 bg-white/6 text-slate-200'
            : 'border-hairline bg-surface text-text-muted shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
        }`}
      >
        {eyebrow}
      </div>
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
    <div className="rounded-[20px] border border-hairline/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,253,0.9))] px-4 py-3 text-sm leading-6 text-text-primary shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span className="text-text-secondary">{children}</span>
      </div>
    </div>
  );
}

function HeroScreenshotPreview() {
  const callouts = [
    {
      label: '01',
      title: 'Choose your input',
      body: 'Use one identity photo, add optional outfit inspiration, or start from scratch.',
    },
    {
      label: '02',
      title: 'Generate the asset',
      body: 'Create a portrait anchor or one coherent 8-panel character sheet.',
    },
    {
      label: '03',
      title: 'Reuse it everywhere',
      body: 'Bring the same reference into prompts, edits, Nano Banana, and still-reference video workflows.',
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-t-[34px] rounded-b-[30px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-end gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>Character Builder workspace</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              choose input, generate asset, reuse
            </span>
          </div>
          <div className="relative aspect-[16/9] bg-[#eef3f9]">
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

function HowItWorksPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-white/80 px-3 py-2 text-sm text-text-secondary shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {children}
    </span>
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
        name: 'Character Builder',
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
      'Create reusable portrait anchors and 8-panel AI character sheets from one image, optional outfit reference, or scratch, then reuse them across images, edits, and still-reference video workflows.',
    featureList: [
      'Start from one identity photo, an optional outfit reference, or a scratch-built concept',
      'Generate a reusable portrait anchor',
      'Generate an 8-panel character sheet with four full-body angles and four matching close-ups',
      'Reuse the same character reference across image prompts and image edits',
      'Use the reference in Nano Banana and video engines that support still references',
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
    name: 'How Character Builder Works',
    description:
      'Create one reusable character reference asset for consistent AI images and still-reference video workflows.',
    step: HOW_IT_WORKS_STEPS.map((step, index) => ({
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
        <div className="container-page relative max-w-[88rem] pb-10 pt-8 sm:pb-12 sm:pt-10 lg:pb-12 lg:pt-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-start lg:gap-12">
            <div className="max-w-4xl stack-gap-lg lg:pt-6">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                <Link href="/" className="transition hover:text-text-primary">
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/tools" className="transition hover:text-text-primary">
                  Tools
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-slate-700">Character Builder</span>
              </nav>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex w-fit items-center rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
                  Consistent Character AI Tool
                </div>
                <div className="inline-flex w-fit items-center rounded-full border border-[#e6b99b] bg-[#fff3ea] px-4 py-2 text-[11px] font-semibold text-[#a55a31] shadow-[0_14px_28px_rgba(244,127,94,0.08)]">
                  Portrait anchor + 8-panel character sheet
                </div>
              </div>

              <div className="stack-gap-sm">
                <h1 className="max-w-[13ch] text-[clamp(3rem,5vw,4.8rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-slate-950">
                  Create a reusable character reference for consistent AI images and video
                </h1>
                <p className="max-w-2xl text-[1.02rem] leading-8 text-slate-600 sm:text-lg">
                  Upload one identity photo, add optional outfit inspiration, or start from scratch. Generate a reusable portrait
                  anchor or 8-panel character sheet you can reuse across scenes, edits, and reference-based video workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <ButtonLink href="/app/tools/character-builder" size="lg">
                  Open Character Builder
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>

              <div className="grid gap-3 xl:max-w-[40rem]">
                {HERO_PROOF_BULLETS.map((item) => (
                  <HeroProofCard key={item}>{item}</HeroProofCard>
                ))}
              </div>
            </div>

            <div className="lg:pt-12 xl:pt-14">
              <HeroScreenshotPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl">
          <div className="overflow-hidden rounded-[34px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,251,254,0.96))] shadow-[0_28px_80px_rgba(15,23,42,0.05)]">
            <div className="grid lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
              <div className="border-b border-white/10 bg-[linear-gradient(180deg,#0a1320,#101d2d)] px-6 py-6 text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Why people need it</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Why AI Characters Drift</h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Prompts can preserve the general idea of a character, but identity details still slip once you start generating multiple scenes.
                </p>
                <div className="mt-5 grid gap-3">
                  {[
                    'Faces and hair change between scenes',
                    'Wardrobe details stop matching',
                    'Silhouette continuity becomes harder to hold',
                  ].map((item) => (
                    <div key={item} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">What this tool creates</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                  Character Builder creates the reference first
                </h2>
                <div className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
                  <p>
                    Generate either a portrait anchor or an 8-panel character sheet, then bring that same reference back into prompts,
                    edits, and still-reference video workflows.
                  </p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Portrait input</p>
                    <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] border border-hairline bg-[#f6efe8]">
                      <Image
                        src={REFERENCE_ASSET_PORTRAIT_URL}
                        alt="Portrait reference used as the base input for Character Builder."
                        fill
                        sizes="(min-width: 640px) 320px, 100vw"
                        className="object-cover object-[center_18%]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Reusable 8-panel sheet</p>
                    <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] border border-hairline bg-[#f8f2ea]">
                      <Image
                        src={LATEST_SHEET_1.url}
                        alt={LATEST_SHEET_1.alt}
                        fill
                        sizes="(min-width: 640px) 320px, 100vw"
                        className={SHEET_IMAGE_CLASSNAME}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="How it works"
            title="Create the reference, then carry it forward"
            body={
              <p>
                Start with a face, an outfit cue, or a scratch-built concept. Generate the output, then bring it back into stills, edits, and video prep.
              </p>
            }
          />
          <div className="rounded-[32px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,254,0.96))] p-4 shadow-[0_22px_56px_rgba(15,23,42,0.05)] sm:p-5 lg:p-6">
            <div className="grid gap-3 lg:grid-cols-3">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  id={`step-${index + 1}`}
                  className="rounded-[24px] border border-hairline bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                        index === 0
                          ? 'bg-[#f97316]/10 text-[#c45b2d]'
                          : index === 1
                            ? 'bg-brand/10 text-brand'
                            : 'bg-[#4c84ff]/10 text-[#3564cc]'
                      }`}
                    >
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{HOW_IT_WORKS_LABELS[index]}</p>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold leading-tight text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{step.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {HOW_IT_WORKS_OPTIONS[index].slice(0, 2).map((item) => (
                      <HowItWorksPill key={item}>{item}</HowItWorksPill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 border-t border-hairline pt-4 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="max-w-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Why it works</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  The reference does the continuity work before you start changing scenes.
                </p>
              </div>
              {COMPARISON_COLUMNS.map((column) => (
                <Card key={column.title} className={`overflow-hidden p-0 ${column.tone}`}>
                  <div className="border-b border-current/10 px-4 py-3">
                    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${column.badgeTone}`}>
                      {column.eyebrow}
                    </div>
                    <h3 className="mt-2 text-base font-semibold tracking-tight text-text-primary">{column.title}</h3>
                  </div>
                  <div className="grid gap-2 px-4 py-3">
                    {column.items.map((item) => (
                      <div key={item} className="rounded-[16px] border border-hairline bg-white/80 px-4 py-2 text-sm leading-6 text-text-secondary">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Outputs and workflow"
            title="Choose the output, then move into stills and video"
            body={
              <p>
                Pick the output that fits the job, then carry it into Nano Banana or still-reference video workflows.
              </p>
            }
          />
          <div className="rounded-[34px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,252,0.96))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.05)] sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-stretch">
              <Card className="overflow-hidden border-hairline bg-white p-0 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
                <div className="p-4">
                  <div className={`relative aspect-[4/4.8] overflow-hidden rounded-[22px] ${OUTPUT_CARDS[0].visualTone}`}>
                    <Image
                      src={OUTPUT_CARDS[0].src}
                      alt={OUTPUT_CARDS[0].alt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 320px"
                      className={OUTPUT_CARDS[0].visualClassName}
                    />
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{OUTPUT_CARDS[0].eyebrow}</p>
                  <h3 className="text-xl font-semibold text-text-primary">{OUTPUT_CARDS[0].title}</h3>
                  <p className="text-sm leading-6 text-text-secondary">{OUTPUT_CARDS[0].body}</p>
                  <div className="pt-1">
                    <HowItWorksPill>Close-ups and edits</HowItWorksPill>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-[1.5px] border-[#f1d1bb] bg-[linear-gradient(180deg,#fff8f3,#fffefc)] p-0 shadow-[0_24px_60px_rgba(196,91,45,0.12)]">
                <div className="flex items-center justify-between px-5 pt-5">
                  <div className="inline-flex rounded-full border border-[#f4d8c6] bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b96135]">
                    Most reusable
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b96135]">4 full-body + 4 close-ups</span>
                </div>
                <div className="px-5 pb-5 pt-4">
                  <div className={`relative aspect-[16/11] overflow-hidden rounded-[24px] ${OUTPUT_CARDS[1].visualTone}`}>
                    <Image
                      src={OUTPUT_CARDS[1].src}
                      alt={OUTPUT_CARDS[1].alt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 480px"
                      className={OUTPUT_CARDS[1].visualClassName}
                    />
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{OUTPUT_CARDS[1].eyebrow}</p>
                  <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{OUTPUT_CARDS[1].title}</h3>
                  <p className="text-sm leading-6 text-text-secondary">{OUTPUT_CARDS[1].body}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <HowItWorksPill>Multi-angle</HowItWorksPill>
                    <HowItWorksPill>Most reusable</HowItWorksPill>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0b1320,#101b2b)] p-0 text-white shadow-[0_26px_64px_rgba(15,23,42,0.16)]">
                <div className="p-4">
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] border border-white/10 bg-black">
                    <Image
                      src={OUTPUT_CARDS[2].src}
                      alt={OUTPUT_CARDS[2].alt}
                      fill
                      sizes="(max-width: 1280px) 100vw, 360px"
                      className={OUTPUT_CARDS[2].visualClassName}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                      Nano Banana still
                    </div>
                  </div>
                </div>
                <div className="stack-gap-sm px-5 pb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{OUTPUT_CARDS[2].eyebrow}</p>
                  <h3 className="text-xl font-semibold text-white">{OUTPUT_CARDS[2].title}</h3>
                  <p className="text-sm leading-6 text-slate-300">{OUTPUT_CARDS[2].body}</p>
                  <div className="pt-1">
                    <HowItWorksPill>Video prep</HowItWorksPill>
                  </div>
                </div>
              </Card>
            </div>
            <div className="mt-6 rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-5 text-white shadow-[0_32px_90px_rgba(15,23,42,0.16)] lg:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Reference workflow</p>
                  <p className="mt-2 text-lg font-semibold tracking-[0.1em] text-white">Character Builder → Nano Banana → Video</p>
                </div>
                <p className="text-sm font-semibold tracking-[0.12em] text-slate-200">Sheet → Still → Video</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,0.82fr)_minmax(0,1.36fr)] lg:items-stretch">
                <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                  <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[#dfe8f4]">
                    <Image
                      src={WORKFLOW_CHARACTER_SHEET_ASSET.url}
                      alt={WORKFLOW_CHARACTER_SHEET_ASSET.alt}
                      fill
                      sizes="(min-width: 1024px) 280px, 100vw"
                      className={SHEET_IMAGE_CLASSNAME}
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">01 · Character sheet</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Lock the character before motion starts.</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                  <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.26),rgba(76,132,255,0.16))]">
                    <Image
                      src={WORKFLOW_NANO_BANANA_ASSET.url}
                      alt={WORKFLOW_NANO_BANANA_ASSET.alt}
                      fill
                      sizes="(min-width: 1024px) 280px, 100vw"
                      className="object-cover object-center"
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">02 · Nano Banana still</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Refine the same character into a cleaner still.</p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#0f1826] p-3">
                  <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black">
                    <video
                      className="aspect-[16/12] w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster={WORKFLOW_VIDEO_START_FRAME_ASSET.url}
                    >
                      <source src={WORKFLOW_VIDEO_START_FRAME_ASSET.videoUrl} type="video/mp4" />
                    </video>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">03 · Video result</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">The same grounded identity carried into motion.</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                      LTX 2.3 Pro
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {WORKFLOW_LINKS.map((link) => (
                  <LinkChip key={link.href} href={link.href} label={link.label} dark />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl stack-gap-lg">
          <SectionHeader
            eyebrow="Use cases"
            title="Where Reusable Character Consistency Matters"
            body={
              <p>
                One character can support creator, commercial, and planning workflows without losing continuity across multiple stills or shots.
              </p>
            }
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <Card className={`overflow-hidden p-0 lg:col-span-7 ${USE_CASES[0].cardClassName}`}>
              <div className="grid h-full gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="flex flex-col justify-between p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${USE_CASES[0].labelClassName}`}>
                      {USE_CASES[0].eyebrow}
                    </div>
                    <span className="text-sm font-semibold tracking-[0.14em] text-slate-300">{USE_CASES[0].number}</span>
                  </div>
                  <div className="mt-10">
                    <h3 className="max-w-md text-3xl font-semibold tracking-tight text-white">{USE_CASES[0].title}</h3>
                    <p className={`mt-4 max-w-md text-base leading-8 ${USE_CASES[0].bodyClassName}`}>{USE_CASES[0].body}</p>
                  </div>
                </div>
                <div className="relative min-h-[280px] overflow-hidden bg-[#0e1725] lg:min-h-full">
                  <Image
                    src={USE_CASES[0].src}
                    alt={USE_CASES[0].alt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 640px"
                    className={USE_CASES[0].imageClassName}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,19,32,0.2),rgba(11,19,32,0)_38%,rgba(11,19,32,0.08))]" />
                </div>
              </div>
            </Card>

            <Card className={`overflow-hidden p-0 lg:col-span-5 ${USE_CASES[1].cardClassName}`}>
              <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ece4]">
                <Image
                  src={USE_CASES[1].src}
                  alt={USE_CASES[1].alt}
                  fill
                  sizes="(max-width: 1280px) 100vw, 480px"
                  className={USE_CASES[1].imageClassName}
                />
              </div>
              <div className="p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${USE_CASES[1].labelClassName}`}>
                    {USE_CASES[1].eyebrow}
                  </div>
                  <span className="text-sm font-semibold tracking-[0.14em] text-brand">{USE_CASES[1].number}</span>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">{USE_CASES[1].title}</h3>
                <p className={`mt-4 text-base leading-8 ${USE_CASES[1].bodyClassName}`}>{USE_CASES[1].body}</p>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {USE_CASES.slice(2).map((useCase) => (
              <Card key={useCase.title} className={`overflow-hidden p-0 lg:col-span-4 ${useCase.cardClassName}`}>
                <div className="relative aspect-[16/10] overflow-hidden bg-[#f5efe8]">
                  <Image
                    src={useCase.src}
                    alt={useCase.alt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 360px"
                    className={useCase.imageClassName}
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${useCase.labelClassName}`}>
                      {useCase.eyebrow}
                    </div>
                    <span className="text-sm font-semibold tracking-[0.14em] text-brand">{useCase.number}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-text-primary">{useCase.title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${useCase.bodyClassName}`}>{useCase.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-4xl stack-gap-lg">
          <SectionHeader
            eyebrow="FAQ"
            title="Consistent Character AI FAQ"
            body={<p>Short answers before you build the reference.</p>}
          />
          <div className="stack-gap-sm">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="rounded-[24px] border border-hairline bg-surface/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.04)]"
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
          <Card className="overflow-hidden border-hairline bg-[linear-gradient(135deg,rgba(8,17,28,0.98),rgba(31,55,82,0.96))] p-0 text-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="stack-gap-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Final CTA</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Build Your Reusable Character Reference</h2>
                <div className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                  <p>
                    Create the character once. Reuse it across images, edits, and video prep.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/app/tools/character-builder" size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                    Open Character Builder
                  </ButtonLink>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  <span>Reusable output</span>
                  <span>8-panel sheet</span>
                </div>
                <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f8f1e9,#fefbf8)]">
                  <Image
                    src={LATEST_SHEET_4.url}
                    alt={LATEST_SHEET_4.alt}
                    fill
                    sizes="420px"
                    className={SHEET_IMAGE_CLASSNAME}
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
