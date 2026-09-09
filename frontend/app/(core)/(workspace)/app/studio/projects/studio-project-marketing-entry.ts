import type { WorkspaceTemplateId } from '../workspace/_lib/workspace-types';

const STARTERS: Readonly<Record<string, WorkspaceTemplateId>> = {
  'product-ad': 'guided-product-ad',
  'storyboard-to-video': 'guided-storyboard-to-video',
  'cinematic-scene': 'guided-cinematic-scene',
};

export function resolveStudioMarketingStarter(value: unknown): WorkspaceTemplateId | null {
  return typeof value === 'string' ? STARTERS[value] ?? null : null;
}
