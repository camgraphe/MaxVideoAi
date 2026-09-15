import type { EngineCaps } from '@/types/engines';

export type HomePriceStep = { seconds: number; resolution: '720p' | '1080p'; amountCents: number; display: string };
export type HomePriceModel = { engine: EngineCaps; workspaceCopy: Record<string, unknown>; steps: HomePriceStep[] };
export const HOME_PRICE_SCENARIOS = [
  {seconds: 5, resolution: '720p'},
  {seconds: 15, resolution: '720p'},
  {seconds: 15, resolution: '1080p'},
] as const;
