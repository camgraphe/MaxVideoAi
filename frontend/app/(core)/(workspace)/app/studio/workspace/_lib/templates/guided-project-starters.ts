import type {
  WorkspaceGuideAnnotation,
  WorkspaceGuideCopyKey,
  WorkspaceGraphNode,
  WorkspaceProjectStarterTemplateId,
  WorkspaceTemplate,
} from '../workspace-types';
import {
  generatedCopyReference,
  localizeWorkspaceTemplateGeneratedState,
} from '../workspace-generated-copy';
import { createWorkspaceEdge, shotSettings } from './template-core';
import type { WorkspaceTemplateBuildCopy } from './registry';

function createGuidedAnnotations(
  templateId: WorkspaceProjectStarterTemplateId,
): WorkspaceGuideAnnotation[] {
  return [
    { id: `${templateId}-guide-reference`, order: 1, copyKey: `${templateId}:reference` as WorkspaceGuideCopyKey, anchor: { kind: 'node', nodeId: 'asset-product-image', target: 'body' }, preferredPlacement: 'top', originTemplateId: templateId },
    { id: `${templateId}-guide-prompt`, order: 2, copyKey: `${templateId}:prompt` as WorkspaceGuideCopyKey, anchor: { kind: 'node', nodeId: 'prompt-product-ad', target: 'body' }, preferredPlacement: 'top', originTemplateId: templateId },
    { id: `${templateId}-guide-generate`, order: 3, copyKey: `${templateId}:generate` as WorkspaceGuideCopyKey, anchor: { kind: 'node', nodeId: 'shot-01', target: 'action' }, preferredPlacement: 'top', originTemplateId: templateId },
    { id: `${templateId}-guide-output`, order: 4, copyKey: `${templateId}:output` as WorkspaceGuideCopyKey, anchor: { kind: 'generated-output', sourceNodeId: 'shot-01' }, preferredPlacement: 'right', originTemplateId: templateId },
    { id: `${templateId}-guide-timeline`, order: 5, copyKey: `${templateId}:timeline` as WorkspaceGuideCopyKey, anchor: { kind: 'surface', surface: 'timeline' }, preferredPlacement: 'top', originTemplateId: templateId },
  ];
}

type GuidedStarterConfig = {
  assetTitle: string;
  assetTitleCopyKey: 'templateProductImage' | 'templateStoryboardFrames' | 'templateMoodPlate';
  assetFilename: string;
  assetUrl: string;
  promptText: string;
  promptTextCopyKey:
    | 'templateProductAdCameraPromptText'
    | 'templateStoryboardPromptText'
    | 'templateCinematicScenePromptText';
  shotSubtitle: string;
  shotSubtitleCopyKey: 'templateHeroReveal' | 'templatePanel01Establish' | 'templateWideEstablishing';
};

const GUIDED_STARTERS: Record<WorkspaceProjectStarterTemplateId, GuidedStarterConfig> = {
  'guided-product-ad': {
    assetTitle: 'Product Image',
    assetTitleCopyKey: 'templateProductImage',
    assetFilename: 'product_reference.png',
    assetUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
    promptText: 'Smooth cinematic orbit around product, slow push in, premium macro lighting.',
    promptTextCopyKey: 'templateProductAdCameraPromptText',
    shotSubtitle: 'Hero Reveal',
    shotSubtitleCopyKey: 'templateHeroReveal',
  },
  'guided-storyboard-to-video': {
    assetTitle: 'Storyboard Frames',
    assetTitleCopyKey: 'templateStoryboardFrames',
    assetFilename: 'storyboard_frames.png',
    assetUrl: '/storyboard/templates/storyboard-template-6.png',
    promptText: 'Follow the storyboard order exactly. Use each panel as a beat, preserve screen direction, and make transitions feel like a planned animatic.',
    promptTextCopyKey: 'templateStoryboardPromptText',
    shotSubtitle: 'Panel 01 Establish',
    shotSubtitleCopyKey: 'templatePanel01Establish',
  },
  'guided-cinematic-scene': {
    assetTitle: 'Mood Plate',
    assetTitleCopyKey: 'templateMoodPlate',
    assetFilename: 'cinematic_mood.png',
    assetUrl: '/hero/best-for-cinematic-realism.webp',
    promptText: 'Build a cinematic trailer beat: wide establishing image, controlled camera push, character reveal, atmosphere, and dramatic final frame.',
    promptTextCopyKey: 'templateCinematicScenePromptText',
    shotSubtitle: 'Wide Establishing',
    shotSubtitleCopyKey: 'templateWideEstablishing',
  },
};

export function createGuidedProjectStarterTemplate(
  templateId: WorkspaceProjectStarterTemplateId,
  copy?: WorkspaceTemplateBuildCopy,
): WorkspaceTemplate {
  const config = GUIDED_STARTERS[templateId];
  const nodes: WorkspaceGraphNode[] = [
    {
      id: 'asset-product-image',
      type: 'asset-image',
      position: { x: -360, y: -90 },
      data: {
        kind: 'asset-image',
        title: config.assetTitle,
        subtitle: config.assetFilename,
        accent: '#8b5cf6',
        generatedCopy: { title: generatedCopyReference(config.assetTitleCopyKey) },
        asset: {
          id: `${templateId}-reference`,
          kind: 'image',
          filename: config.assetFilename,
          subtitle: 'Image · 1920x1080',
          url: config.assetUrl,
          thumbUrl: config.assetUrl,
          dimensions: '1920x1080',
        },
        sourceHandles: ['reference'],
      },
    },
    {
      id: 'prompt-product-ad',
      type: 'text-prompt',
      position: { x: -360, y: 180 },
      data: {
        kind: 'text-prompt',
        title: 'Prompt',
        subtitle: 'prompt.txt',
        accent: '#60a5fa',
        generatedCopy: {
          title: generatedCopyReference('promptBlock'),
          promptText: generatedCopyReference(config.promptTextCopyKey),
        },
        promptRole: 'prompt',
        promptText: config.promptText,
        sourceHandles: ['prompt'],
      },
    },
    {
      id: 'shot-01',
      type: 'shot',
      position: { x: 40, y: 0 },
      selected: true,
      data: {
        kind: 'shot',
        title: 'Video generation',
        subtitle: config.shotSubtitle,
        accent: '#f97316',
        generatedCopy: {
          title: generatedCopyReference('videoGenerationTitle'),
          subtitle: generatedCopyReference(config.shotSubtitleCopyKey),
          shotOutputName: generatedCopyReference(config.shotSubtitleCopyKey),
        },
        shot: shotSettings({
          presetId: 'generate-video',
          family: 'video',
          outputKind: 'video',
          modelId: 'seedance-2-0',
          workflowType: 'image_to_video',
          outputName: config.shotSubtitle,
          status: 'draft',
        }),
        targetHandles: ['prompt', 'start_image', 'end_image'],
        sourceHandles: ['video_reference'],
      },
    },
  ];
  const template: WorkspaceTemplate = {
    id: templateId,
    name: config.shotSubtitle,
    nodes,
    edges: [
      createWorkspaceEdge({
        id: `${templateId}-prompt-edge`,
        source: 'prompt-product-ad',
        target: 'shot-01',
        sourceHandle: 'prompt',
        targetHandle: 'prompt',
        kind: 'prompt',
      }),
      createWorkspaceEdge({
        id: `${templateId}-image-edge`,
        source: 'asset-product-image',
        target: 'shot-01',
        sourceHandle: 'reference',
        targetHandle: 'start_image',
        kind: 'start_image',
      }),
    ],
    timelineItems: [],
    guideAnnotations: createGuidedAnnotations(templateId),
    focusNodeId: 'shot-01',
  };
  return copy ? localizeWorkspaceTemplateGeneratedState(template, copy) : template;
}
