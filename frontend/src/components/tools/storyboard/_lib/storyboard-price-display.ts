import type { StoryboardTargetModel } from './storyboard-prompt';

export type StoryboardVisiblePrice = { cents: number; currency: string } | null;

export function addStoryboardVisiblePrices(
  left: StoryboardVisiblePrice,
  right: StoryboardVisiblePrice
): StoryboardVisiblePrice {
  if (!left || !right) return null;
  return {
    cents: left.cents + right.cents,
    currency: left.currency || right.currency || 'USD',
  };
}

export function resolveStoryboardVisiblePrice(params: {
  targetModel: StoryboardTargetModel;
  tierPrice: StoryboardVisiblePrice;
  klingFirstFramePrice: StoryboardVisiblePrice;
}): StoryboardVisiblePrice {
  if (params.targetModel !== 'kling') return params.tierPrice;
  return addStoryboardVisiblePrices(params.tierPrice, params.klingFirstFramePrice);
}
