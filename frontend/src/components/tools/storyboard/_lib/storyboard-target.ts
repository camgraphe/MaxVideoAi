import type { StoryboardTargetModel } from './storyboard-prompt';

export function resolveStoryboardRecommendedTarget(recognizablePeople: boolean): StoryboardTargetModel {
  void recognizablePeople;
  return 'seedance';
}

export function isStoryboardTargetRecommended(
  target: StoryboardTargetModel,
  recognizablePeople: boolean
): boolean {
  return target === resolveStoryboardRecommendedTarget(recognizablePeople);
}
