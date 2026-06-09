import type { WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceTemplate, WorkspaceTimelineItem } from '../workspace-types';
import { WORKSPACE_DEMO_AUDIO_URL } from '../workspace-library-assets';
import { createWorkspaceEdge, shotSettings } from './template-core';

function devBlocksTimeline(): WorkspaceTimelineItem[] {
  return [
    {
      id: 'timeline-dev-output',
      outputNodeId: 'dev-output',
      track: 'video',
      title: 'Dev Output Block',
      durationSec: 6,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 6,
      linkedGroupId: 'timeline-dev-output',
      mediaKind: 'video',
      hasEmbeddedAudio: true,
      mediaUrl: '/hero/veo3.mp4',
      thumbnailUrl: '/hero/showcase-veo-3-1.webp',
      modelId: 'veo-3-1',
      status: 'completed',
    },
    {
      id: 'timeline-dev-output-audio',
      outputNodeId: 'dev-output',
      track: 'audio',
      title: 'Dev Output Block Audio',
      durationSec: 6,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 6,
      linkedGroupId: 'timeline-dev-output',
      mediaKind: 'audio',
      mediaUrl: '/hero/veo3.mp4',
      modelId: 'veo-3-1',
      status: 'completed',
    },
  ];
}


export function createDevBlocksWorkspaceTemplate(): WorkspaceTemplate {
  const nodes: WorkspaceGraphNode[] = [
    {
      id: 'dev-asset-image',
      type: 'asset-image',
      position: { x: -520, y: -220 },
      data: {
        kind: 'asset-image',
        title: 'Dev Image Block',
        subtitle: 'asset-image node',
        accent: '#8b5cf6',
        asset: {
          id: 'dev-image',
          kind: 'image',
          filename: 'dev_product_reference.png',
          subtitle: 'Image · reference',
          url: '/storyboard/examples/storyboarder-product-reference.jpg',
          thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
          dimensions: '2048x2048',
        },
        sourceHandles: ['reference'],
      },
    },
    {
      id: 'dev-asset-video',
      type: 'asset-video',
      position: { x: -160, y: -220 },
      data: {
        kind: 'asset-video',
        title: 'Dev Video Block',
        subtitle: 'asset-video node',
        accent: '#2563eb',
        asset: {
          id: 'dev-video',
          kind: 'video',
          filename: 'dev_motion_reference.mp4',
          subtitle: 'Video · 6s',
          url: '/hero/pika-22.mp4',
          thumbUrl: '/hero/kling-3-4k-demo.jpg',
          durationSec: 6,
        },
        sourceHandles: ['video_reference'],
      },
    },
    {
      id: 'dev-asset-audio',
      type: 'asset-audio',
      position: { x: 200, y: -220 },
      data: {
        kind: 'asset-audio',
        title: 'Dev Audio Block',
        subtitle: 'asset-audio node',
        accent: '#22c55e',
        asset: {
          id: 'dev-audio',
          kind: 'audio',
          filename: 'dev_music_reference.wav',
          subtitle: 'Audio · 12s',
          url: WORKSPACE_DEMO_AUDIO_URL,
          durationSec: 12,
        },
        sourceHandles: ['audio'],
      },
    },
    {
      id: 'dev-text-prompt',
      type: 'text-prompt',
      position: { x: -520, y: 85 },
      data: {
        kind: 'text-prompt',
        title: 'Dev Prompt Block',
        subtitle: 'text-prompt node',
        accent: '#60a5fa',
        promptRole: 'prompt',
        promptText: 'Use this dev template to tune the prompt block, textarea, handles, spacing, and inspector states.',
        sourceHandles: ['prompt'],
      },
    },
    {
      id: 'dev-shot',
      type: 'shot',
      position: { x: -160, y: 85 },
      data: {
        kind: 'shot',
        title: 'Dev Shot Block',
        subtitle: 'shot node',
        accent: '#f97316',
        shot: shotSettings({
          outputName: 'Dev Shot Block',
          modelId: 'veo-3-1',
          durationSec: 6,
          status: 'ready',
        }),
        targetHandles: [
          'prompt',
          'negative_prompt',
          'start_image',
          'end_image',
          'reference',
          'video_reference',
          'motion_reference',
          'audio',
          'voiceover',
          'music',
          'camera',
          'dialogue',
          'narration',
          'previous_shot',
        ],
        sourceHandles: ['generated_output'],
      },
    },
    {
      id: 'dev-output',
      type: 'output',
      position: { x: 200, y: 85 },
      data: {
        kind: 'output',
        title: 'Dev Output Block',
        subtitle: 'output node',
        accent: '#14b8a6',
        output: {
          kind: 'video',
          modelId: 'veo-3-1',
          modelLabel: 'Veo 3.1',
          workflowType: 'image_to_video',
          durationSec: 6,
          aspectRatio: '16:9',
          resolution: '1080p',
          createdAt: new Date('2026-06-05T10:00:00.000Z').toISOString(),
          sourceShotId: 'dev-shot',
          thumbUrl: '/hero/showcase-veo-3-1.webp',
          url: '/hero/veo3.mp4',
          hasAudio: true,
          jobId: 'dev-template-output',
        },
        targetHandles: ['generated_output'],
        sourceHandles: ['video_reference'],
      },
    },
  ];

  const edges: WorkspaceGraphEdge[] = [
    createWorkspaceEdge({ source: 'dev-asset-image', target: 'dev-shot', sourceHandle: 'reference', targetHandle: 'start_image', kind: 'start_image' }),
    createWorkspaceEdge({ source: 'dev-asset-video', target: 'dev-shot', sourceHandle: 'video_reference', targetHandle: 'video_reference', kind: 'video_reference' }),
    createWorkspaceEdge({ source: 'dev-text-prompt', target: 'dev-shot', sourceHandle: 'prompt', targetHandle: 'prompt', kind: 'prompt' }),
    createWorkspaceEdge({ source: 'dev-shot', target: 'dev-output', kind: 'generated_output' }),
  ];

  return {
    id: 'dev-blocks',
    name: 'Dev Blocks',
    nodes,
    edges,
    timelineItems: devBlocksTimeline(),
  };
}

