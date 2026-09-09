import type { WorkspaceGraphNode, WorkspaceTemplate } from '../workspace-types';
import {
  generatedCopyReference,
  localizeWorkspaceTemplateGeneratedState,
} from '../workspace-generated-copy';
import { createWorkspaceEdge, shotSettings } from './template-core';
import type { WorkspaceTemplateBuildCopy } from './registry';

export const MINIMAL_START_WORKSPACE_TEMPLATE_ID = 'minimal-start' as const;
export const MINIMAL_START_PROMPT_NODE_ID = 'minimal-start-prompt';
export const MINIMAL_START_VIDEO_NODE_ID = 'minimal-start-video';

export function createMinimalStartWorkspaceTemplate(
  copy?: WorkspaceTemplateBuildCopy
): WorkspaceTemplate {
  const nodes: WorkspaceGraphNode[] = [
    {
      id: MINIMAL_START_PROMPT_NODE_ID,
      type: 'text-prompt',
      position: { x: 0, y: 40 },
      data: {
        kind: 'text-prompt',
        title: 'Prompt',
        subtitle: 'prompt.txt',
        accent: '#60a5fa',
        generatedCopy: { title: generatedCopyReference('promptBlock') },
        promptRole: 'prompt',
        promptText: '',
        sourceHandles: ['prompt'],
      },
    },
    {
      id: MINIMAL_START_VIDEO_NODE_ID,
      type: 'shot',
      position: { x: 360, y: 0 },
      selected: true,
      data: {
        kind: 'shot',
        title: 'Video generation',
        subtitle: 'Model-aware video generation block.',
        accent: '#f97316',
        generatedCopy: {
          title: generatedCopyReference('videoGenerationTitle'),
          subtitle: generatedCopyReference('videoGenerationSubtitle'),
          shotOutputName: generatedCopyReference('videoGenerationTitle'),
        },
        shot: shotSettings({
          presetId: 'generate-video',
          family: 'video',
          outputKind: 'video',
          modelId: 'seedance-2-0',
          workflowType: 'text_to_video',
          outputName: 'Video output',
          status: 'draft',
        }),
        targetHandles: ['prompt', 'start_image', 'end_image', 'reference', 'style', 'camera', 'audio'],
        sourceHandles: ['video_reference'],
      },
    },
  ];
  const template: WorkspaceTemplate = {
    id: MINIMAL_START_WORKSPACE_TEMPLATE_ID,
    name: 'New canvas',
    nodes,
    edges: [createWorkspaceEdge({
      id: 'minimal-start-prompt-edge',
      source: MINIMAL_START_PROMPT_NODE_ID,
      target: MINIMAL_START_VIDEO_NODE_ID,
      sourceHandle: 'prompt',
      targetHandle: 'prompt',
      kind: 'prompt',
    })],
    timelineItems: [],
    focusNodeId: MINIMAL_START_VIDEO_NODE_ID,
  };
  return copy ? localizeWorkspaceTemplateGeneratedState(template, copy) : template;
}
