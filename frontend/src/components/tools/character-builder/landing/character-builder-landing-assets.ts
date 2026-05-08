import type { Dictionary } from '@/lib/i18n/types';

export const REFERENCE_ASSET_PORTRAIT_URL =
  'https://media.maxvideoai.com/marketing/marketing/517ee430-3e1a-40e4-8ac9-55f422afde88.png';

export const LATEST_CHARACTER_SHEET_ASSETS = [
  {
    url: 'https://media.maxvideoai.com/marketing/marketing/bfe7f0d7-ed39-4953-863c-ec2be73f3065.png',
    alt: 'Recent Character Builder character sheet render showing four full-body angles and four matching close-ups.',
  },
  {
    url: 'https://media.maxvideoai.com/marketing/marketing/b508fe8d-a858-41a4-8b27-c9706ea3a50c.png',
    alt: 'Recent coherent character sheet render from MaxVideoAI with multi-angle full-body views and close-ups.',
  },
  {
    url: 'https://media.maxvideoai.com/marketing/marketing/1123d92d-7204-4be9-bd39-5ddb85e09fba.png',
    alt: 'Recent MaxVideoAI character sheet render combining four body angles and four close-up identity views.',
  },
  {
    url: 'https://media.maxvideoai.com/marketing/marketing/f195f99e-04b7-4512-85c6-a602d0250b19.png',
    alt: 'Recent reusable character sheet render with stable face, outfit, and silhouette across eight panels.',
  },
] as const;

export const [LATEST_SHEET_1, , , LATEST_SHEET_4] = LATEST_CHARACTER_SHEET_ASSETS;

export const WORKFLOW_CHARACTER_SHEET_ASSET = {
  url: 'https://media.maxvideoai.com/marketing/marketing/bfe7f0d7-ed39-4953-863c-ec2be73f3065.png',
  alt: 'Character Builder sheet used as the reusable reference asset across images and video workflows.',
} as const;
export const WORKFLOW_NANO_BANANA_ASSET = {
  url: 'https://media.maxvideoai.com/marketing/marketing/ca5357cf-ec09-4327-bc18-03eeff7e7a66.jpg',
  alt: 'Nano Banana still created from the same character sheet reference.',
} as const;
export const WORKFLOW_VIDEO_START_FRAME_ASSET = {
  videoUrl: 'https://media.maxvideoai.com/renders/marketing/5816f421-1b4f-456b-aa53-229fa6742cbd.mp4',
  url: 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/355c847c-7866-43b9-af28-85d6a64dfec8.jpg',
  alt: 'Video start frame generated from the Nano Banana still and the same character identity.',
} as const;
export const COMICS_PREVIZ_USE_CASE_ASSET = {
  url: 'https://media.maxvideoai.com/marketing/marketing/27e8772d-6705-47d8-925f-4652230d1ba2.png',
  alt: 'Reusable character reference prepared for comics panels and animation previz.',
} as const;
export const MASCOT_USE_CASE_ASSET = {
  url: 'https://media.maxvideoai.com/marketing/marketing/de347ddc-1963-45b2-8e17-9d3b31cbaba7.png',
  alt: 'Brand mascot prepared as a reusable consistent character asset.',
} as const;

export const CHARACTER_WORKSPACE_HERO_PATH = '/assets/tools/character-builder-workspace.png?hero=1';
export const SHEET_IMAGE_CLASSNAME = 'object-cover object-center scale-[1.08]';

export type CharacterBuilderLandingContent = Dictionary['toolMarketing']['characterBuilder'];

export const COMPARISON_STYLES = [
  {
    tone: 'character-builder-comparison character-builder-comparison--negative border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,245,0.96))]',
    badgeTone: 'bg-rose-100 text-rose-700',
  },
  {
    tone: 'character-builder-comparison character-builder-comparison--positive border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,253,245,0.96))]',
    badgeTone: 'bg-emerald-100 text-emerald-700',
  },
] as const;

export const USE_CASE_VISUALS = [
  {
    src: WORKFLOW_VIDEO_START_FRAME_ASSET.url,
    imageClassName: 'object-cover object-center',
    cardClassName: 'border-slate-800 bg-[linear-gradient(135deg,#0b1320,#162235)] text-white shadow-[0_32px_90px_rgba(15,23,42,0.18)]',
    labelClassName: 'border-white/10 bg-white/5 text-slate-200',
    bodyClassName: 'text-slate-300',
  },
  {
    src: REFERENCE_ASSET_PORTRAIT_URL,
    imageClassName: 'object-cover object-[center_18%]',
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,241,236,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: MASCOT_USE_CASE_ASSET.url,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,246,238,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: 'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/8b29c715-842e-473c-a0d3-5ce8d6d6857f.webp',
    imageClassName: 'object-cover object-center',
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,246,251,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
  {
    src: COMICS_PREVIZ_USE_CASE_ASSET.url,
    imageClassName: SHEET_IMAGE_CLASSNAME,
    cardClassName:
      'character-builder-usecase-card border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,245,250,0.96))]',
    labelClassName: 'character-builder-usecase-label border-hairline bg-white/80 text-text-muted',
    bodyClassName: 'text-text-secondary',
  },
] as const;
