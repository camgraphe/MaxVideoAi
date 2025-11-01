export type MiniEngineCard = {
  key: string;
  name: string;
  maxDuration: string;
  audio: string;
  bestFor: string;
  href: string;
  bg: string;
};

export const ENGINES_MINI: MiniEngineCard[] = [
  {
    key: 'sora-2',
    name: 'Sora 2',
    maxDuration: '6–8s',
    audio: 'Yes',
    bestFor: 'Cinematic shots',
    href: '/models/sora-2',
    bg: '/hero/sora2.jpg',
  },
  {
    key: 'veo-3-1',
    name: 'Veo 3.1',
    maxDuration: '8–12s',
    audio: 'Yes',
    bestFor: 'Ads & B-roll',
    href: '/models/veo-3-1',
    bg: '/hero/veo3.jpg',
  },
  {
    key: 'pika-2-2',
    name: 'Pika 2.2',
    maxDuration: '3–6s',
    audio: 'Yes',
    bestFor: 'Fast iterations',
    href: '/models/pika-2-2',
    bg: '/hero/pika-22.jpg',
  },
  {
    key: 'minimax-hailuo-02',
    name: 'MiniMax Hailuo 02',
    maxDuration: '6–8s',
    audio: 'Yes',
    bestFor: 'Stylised motion',
    href: '/models/minimax-hailuo-02',
    bg: '/hero/minimax-video01.jpg',
  },
];

