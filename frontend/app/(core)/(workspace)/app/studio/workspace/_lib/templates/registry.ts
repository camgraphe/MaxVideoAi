import type {
  WorkspacePublicTemplateId,
  WorkspaceProjectStarterTemplateId,
  WorkspaceTemplate,
  WorkspaceTemplateId,
  WorkspaceTemplateSummary,
} from '../workspace-types';
import type { StudioCopy } from '../../../_lib/studio-copy';
import { createCharacterDialogueWorkspaceTemplate } from './character-dialogue';
import { createCinematicSceneWorkspaceTemplate } from './cinematic-scene';
import { createDevBlocksWorkspaceTemplate } from './dev-blocks';
import {
  MINIMAL_START_WORKSPACE_TEMPLATE_ID,
  createMinimalStartWorkspaceTemplate,
} from './minimal-start';
import { createProductAdWorkspaceTemplate } from './product-ad';
import { createStoryboardToVideoWorkspaceTemplate } from './storyboard-to-video';
import { createUgcAdWorkspaceTemplate } from './ugc-ad';
import { createGuidedProjectStarterTemplate } from './guided-project-starters';

const GUIDED_PROJECT_STARTER_IDS: WorkspaceProjectStarterTemplateId[] = [
  'guided-product-ad',
  'guided-storyboard-to-video',
  'guided-cinematic-scene',
];

function isGuidedProjectStarterTemplateId(value: unknown): value is WorkspaceProjectStarterTemplateId {
  return typeof value === 'string' && GUIDED_PROJECT_STARTER_IDS.includes(value as WorkspaceProjectStarterTemplateId);
}

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


export type WorkspaceTemplateBuildCopy = StudioCopy['canvas']['nodes'];
type WorkspaceTemplateBuilder = (summary: WorkspaceTemplateSummary, copy?: WorkspaceTemplateBuildCopy) => WorkspaceTemplate;

function requireWorkspaceTemplateSummary(templateId: WorkspacePublicTemplateId): WorkspaceTemplateSummary {
  const summary = WORKSPACE_TEMPLATE_SUMMARIES.find((entry) => entry.id === templateId);
  if (!summary) return WORKSPACE_TEMPLATE_SUMMARIES[0];
  return summary;
}

export const WORKSPACE_TEMPLATE_REGISTRY: Record<WorkspacePublicTemplateId, WorkspaceTemplateBuilder> = {
  'product-ad': (_summary, copy) => createProductAdWorkspaceTemplate(copy),
  'dev-blocks': (_summary, copy) => createDevBlocksWorkspaceTemplate(copy),
  'character-dialogue': createCharacterDialogueWorkspaceTemplate,
  'storyboard-to-video': createStoryboardToVideoWorkspaceTemplate,
  'ugc-ad': createUgcAdWorkspaceTemplate,
  'cinematic-scene': createCinematicSceneWorkspaceTemplate,
};

export function createStarterWorkspaceTemplate(templateId: WorkspaceTemplateId, copy?: WorkspaceTemplateBuildCopy): WorkspaceTemplate {
  if (templateId === MINIMAL_START_WORKSPACE_TEMPLATE_ID) {
    return createMinimalStartWorkspaceTemplate(copy);
  }
  if (isGuidedProjectStarterTemplateId(templateId)) {
    return createGuidedProjectStarterTemplate(templateId, copy);
  }
  const summary = requireWorkspaceTemplateSummary(templateId);
  return WORKSPACE_TEMPLATE_REGISTRY[summary.id](summary, copy);
}

export function isWorkspaceTemplateId(value: unknown): value is WorkspaceTemplateId {
  return value === MINIMAL_START_WORKSPACE_TEMPLATE_ID ||
    isGuidedProjectStarterTemplateId(value) ||
    (typeof value === 'string' && WORKSPACE_TEMPLATE_SUMMARIES.some((summary) => summary.id === value));
}
