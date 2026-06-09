import type { WorkspaceTemplate, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../workspace-types';
import { createCharacterDialogueWorkspaceTemplate } from './character-dialogue';
import { createCinematicSceneWorkspaceTemplate } from './cinematic-scene';
import { createDevBlocksWorkspaceTemplate } from './dev-blocks';
import { createProductAdWorkspaceTemplate } from './product-ad';
import { createStoryboardToVideoWorkspaceTemplate } from './storyboard-to-video';
import { createUgcAdWorkspaceTemplate } from './ugc-ad';

export const WORKSPACE_TEMPLATE_SUMMARIES: WorkspaceTemplateSummary[] = [
  {
    id: 'product-ad',
    name: 'Product Ad',
    description: 'Product image, logo, style, music, four shot blocks, and launch timeline.',
    thumbnailUrl: '/assets/model-examples/seedream/product.webp',
    badge: 'Pro',
    flow: 'Product ref -> style clip -> 4 shots',
    accent: '#8b5cf6',
  },
  {
    id: 'dev-blocks',
    name: 'Dev Blocks',
    description: 'Focused component development and testing workflow.',
    thumbnailUrl: '/assets/marketing/app-dashboard.webp',
    badge: 'Pro',
    flow: 'Every block -> connectors -> output QA',
    accent: '#7c3aed',
  },
  {
    id: 'character-dialogue',
    name: 'Character Dialogue',
    description: 'Character reference, dialogue prompt, voiceover, and continuity shots.',
    thumbnailUrl: '/assets/blog/character-builder/consistent-character-portrait-anchor.webp',
    badge: 'Pro',
    flow: 'Character anchor -> dialogue -> voice',
    accent: '#ec4899',
  },
  {
    id: 'storyboard-to-video',
    name: 'Storyboard Flow',
    description: 'Board frames, camera notes, continuity links, and empty outputs.',
    thumbnailUrl: '/storyboard/templates/storyboard-template-6.png',
    badge: 'Pro',
    flow: 'Panels -> shot plan -> sequence',
    accent: '#38bdf8',
  },
  {
    id: 'ugc-ad',
    name: 'UGC Hook',
    description: 'Talking-head reference, hook script, b-roll shots, voice and music.',
    thumbnailUrl: '/assets/tools/character-builder-workspace.png',
    badge: 'Pro',
    flow: 'Hook script -> avatar -> b-roll',
    accent: '#f97316',
  },
  {
    id: 'cinematic-scene',
    name: 'Cinematic Trailer',
    description: 'Style plate, camera plan, scene prompts, sound design, and sequence.',
    thumbnailUrl: '/hero/best-for-cinematic-realism.webp',
    badge: 'Pro',
    flow: 'Mood plate -> camera -> trailer shots',
    accent: '#22c55e',
  },
];


type WorkspaceTemplateBuilder = (summary: WorkspaceTemplateSummary) => WorkspaceTemplate;

function requireWorkspaceTemplateSummary(templateId: WorkspaceTemplateId): WorkspaceTemplateSummary {
  const summary = WORKSPACE_TEMPLATE_SUMMARIES.find((entry) => entry.id === templateId);
  if (!summary) return WORKSPACE_TEMPLATE_SUMMARIES[0];
  return summary;
}

export const WORKSPACE_TEMPLATE_REGISTRY: Record<WorkspaceTemplateId, WorkspaceTemplateBuilder> = {
  'product-ad': () => createProductAdWorkspaceTemplate(),
  'dev-blocks': () => createDevBlocksWorkspaceTemplate(),
  'character-dialogue': createCharacterDialogueWorkspaceTemplate,
  'storyboard-to-video': createStoryboardToVideoWorkspaceTemplate,
  'ugc-ad': createUgcAdWorkspaceTemplate,
  'cinematic-scene': createCinematicSceneWorkspaceTemplate,
};

export function createStarterWorkspaceTemplate(templateId: WorkspaceTemplateId): WorkspaceTemplate {
  const summary = requireWorkspaceTemplateSummary(templateId);
  const builder = WORKSPACE_TEMPLATE_REGISTRY[summary.id] ?? WORKSPACE_TEMPLATE_REGISTRY['product-ad'];
  return builder(summary);
}
