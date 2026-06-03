import type { StoryboardTargetModel } from './storyboard-prompt';

export function resolveStoryboardRecommendedTarget(recognizablePeople: boolean): StoryboardTargetModel {
  return recognizablePeople ? 'kling' : 'seedance';
}

export function isStoryboardTargetRecommended(
  target: StoryboardTargetModel,
  recognizablePeople: boolean
): boolean {
  return target === resolveStoryboardRecommendedTarget(recognizablePeople);
}
