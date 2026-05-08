import type { Dictionary } from '@/lib/i18n/types';

export const ANGLE_SOURCE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/b2358480-cc56-4fcf-9376-cf010d7222ac.webp';
export const ANGLE_OUTPUT_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/7a859184-b718-4481-ae01-35efe66f4c9a.webp';
export const ANGLE_ALT_THREE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/79fe6fd7-60cf-4419-a143-a2cb52e9b762.webp';
export const ANGLE_STORY_SOURCE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp';
export const ANGLE_HERO_OUTPUT_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';
export const ANGLE_WORKSPACE_SCREENSHOT_PATH = '/assets/tools/angle-workspace.png';
export const ANGLE_LATEST_BATCH_URLS = [
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/6ad2e206-588e-4f08-80e7-cf4a18d045bf.webp',
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/3164706b-97b3-4407-980c-2195dfd7181d.webp',
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/bd02027e-90e1-4927-9439-789611ede414.webp',
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/838d059c-4cf8-4a36-9be7-66fb9ab4604d.webp',
] as const;

export const MOBILE_IMAGE_MAX_WIDTH = 'mx-auto w-full max-w-[280px] sm:max-w-none';

export type AngleLandingContent = Dictionary['toolMarketing']['angle'];
export type AngleThumbContent = {
  label: string;
  note: string;
  alt: string;
};

export const HOW_IT_WORKS_STEP_STYLES = [
  {
    badge: 'bg-[#fff2e8] text-[#c05a1b]',
    line: 'from-[#fb923c] via-[#fdba74] to-transparent',
    card: 'angle-how-step angle-how-step--1',
  },
  {
    badge: 'bg-[#edf4ff] text-[#2563eb]',
    line: 'from-[#60a5fa] via-[#93c5fd] to-transparent',
    card: 'angle-how-step angle-how-step--2',
  },
  {
    badge: 'bg-[#eef8ff] text-[#0f5d7a]',
    line: 'from-[#22d3ee] via-[#67e8f9] to-transparent',
    card: 'angle-how-step angle-how-step--3',
  },
] as const;
