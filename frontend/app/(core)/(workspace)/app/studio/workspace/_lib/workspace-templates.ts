import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspacePromptRole,
  WorkspaceShotSettings,
  WorkspaceTemplate,
  WorkspaceTemplateId,
  WorkspaceTemplateSummary,
  WorkspaceTimelineItem,
} from './workspace-types';
import { WORKSPACE_DEMO_AUDIO_URL } from './workspace-library-assets';

const PRODUCT_AD_SHOT_01_DURATION_SEC = 5;
const PRODUCT_AD_SHOT_02_DURATION_SEC = 8;
const DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID = 'seedance-2-0';

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

export const WORKSPACE_EDGE_COLORS: Record<WorkspaceEdgeKind, string> = {
  reference: '#8b5cf6',
  start_image: '#8b5cf6',
  end_image: '#c084fc',
  product: '#a855f7',
  character: '#ec4899',
  style: '#d946ef',
  composition: '#38bdf8',
  logo: '#facc15',
  prompt: '#60a5fa',
  negative_prompt: '#fb7185',
  camera: '#22d3ee',
  dialogue: '#f97316',
  narration: '#fb923c',
  audio: '#22c55e',
  voiceover: '#14b8a6',
  music: '#16a34a',
  sfx: '#7c3aed',
  motion_reference: '#3b82f6',
  previous_shot: '#06b6d4',
  continuity: '#2dd4bf',
  generated_output: '#f97316',
  output_to_timeline: '#eab308',
  video_reference: '#2563eb',
};

const EDGE_LABELS: Record<WorkspaceEdgeKind, string> = {
  reference: 'Reference',
  start_image: 'Start image',
  end_image: 'End image',
  product: 'Product',
  character: 'Character',
  style: 'Style',
  composition: 'Composition',
  logo: 'Logo',
  prompt: 'Prompt',
  negative_prompt: 'Negative',
  camera: 'Camera',
  dialogue: 'Dialogue',
  narration: 'Narration',
  audio: 'Audio',
  voiceover: 'Voice',
  music: 'Music',
  sfx: 'SFX',
  motion_reference: 'Motion',
  previous_shot: 'Previous shot',
  continuity: 'Continuity',
  generated_output: 'Output',
  output_to_timeline: 'Timeline',
  video_reference: 'Video ref',
};

export function edgeLabel(kind: WorkspaceEdgeKind): string {
  return EDGE_LABELS[kind] ?? kind;
}

export function inferWorkspaceEdgeKind(sourceHandle?: string | null, targetHandle?: string | null): WorkspaceEdgeKind {
  const raw = (targetHandle || sourceHandle || 'reference') as WorkspaceEdgeKind;
  if (raw === 'start_image' || raw === 'end_image') return raw;
  if (raw === 'product' || raw === 'character' || raw === 'style' || raw === 'composition' || raw === 'logo') return raw;
  if (raw === 'prompt' || raw === 'negative_prompt' || raw === 'camera' || raw === 'dialogue' || raw === 'narration') return raw;
  if (raw === 'audio' || raw === 'voiceover' || raw === 'music' || raw === 'sfx') return raw;
  if (raw === 'motion_reference' || raw === 'previous_shot' || raw === 'video_reference' || raw === 'continuity') return raw;
  if (raw === 'generated_output' || raw === 'output_to_timeline') return raw;
  return 'reference';
}

export function createWorkspaceEdge(params: {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  kind: WorkspaceEdgeKind;
}): WorkspaceGraphEdge {
  const color = WORKSPACE_EDGE_COLORS[params.kind];
  return {
    id: params.id ?? `${params.source}-${params.kind}-${params.target}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? params.kind,
    targetHandle: params.targetHandle ?? params.kind,
    type: 'workspace-smart',
    animated: params.kind === 'generated_output' || params.kind === 'output_to_timeline',
    label: edgeLabel(params.kind),
    data: {
      kind: params.kind,
      label: edgeLabel(params.kind),
      color,
    },
    style: {
      stroke: color,
      strokeWidth: 2,
    },
  };
}

function shotSettings(overrides: Partial<WorkspaceShotSettings>): WorkspaceShotSettings {
  return {
    modelId: DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID,
    workflowType: 'image_to_video',
    durationSec: 7,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    seed: null,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.65,
    outputName: 'Shot',
    status: 'ready',
    ...overrides,
  };
}

function productAdTimeline(): WorkspaceTimelineItem[] {
  return [
    {
      id: 'timeline-output-01',
      outputNodeId: 'output-01',
      track: 'video',
      title: 'Shot 01 - Hero Reveal',
      durationSec: PRODUCT_AD_SHOT_01_DURATION_SEC,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: PRODUCT_AD_SHOT_01_DURATION_SEC,
      linkedGroupId: 'timeline-output-01',
      mediaKind: 'video',
      mediaUrl: '/hero/pika-22.mp4',
      thumbnailUrl: '/hero/showcase-kling-3-pro.webp',
      modelId: 'kling-3-pro',
      status: 'completed',
    },
    {
      id: 'timeline-output-02',
      outputNodeId: 'output-02',
      track: 'video',
      title: 'Shot 02 - Macro Details',
      durationSec: PRODUCT_AD_SHOT_02_DURATION_SEC,
      startSec: PRODUCT_AD_SHOT_01_DURATION_SEC,
      sourceStartSec: 0,
      sourceDurationSec: PRODUCT_AD_SHOT_02_DURATION_SEC,
      linkedGroupId: 'timeline-output-02',
      mediaKind: 'video',
      hasEmbeddedAudio: true,
      mediaUrl: '/hero/veo3.mp4',
      thumbnailUrl: '/hero/showcase-veo-3-1.webp',
      modelId: 'veo-3-1',
      status: 'completed',
    },
    {
      id: 'timeline-output-02-audio',
      outputNodeId: 'output-02',
      track: 'audio',
      title: 'Shot 02 - Macro Details Audio',
      durationSec: PRODUCT_AD_SHOT_02_DURATION_SEC,
      startSec: PRODUCT_AD_SHOT_01_DURATION_SEC,
      sourceStartSec: 0,
      sourceDurationSec: PRODUCT_AD_SHOT_02_DURATION_SEC,
      linkedGroupId: 'timeline-output-02',
      mediaKind: 'audio',
      mediaUrl: '/hero/veo3.mp4',
      modelId: 'veo-3-1',
      status: 'completed',
    },
    {
      id: 'timeline-music-01',
      outputNodeId: 'audio-music-01',
      track: 'audio-2',
      title: 'ambient_moody.mp3',
      durationSec: 28,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 28,
      mediaKind: 'audio',
      status: 'ready',
    },
  ];
}

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

export function createProductAdWorkspaceTemplate(): WorkspaceTemplate {
  const nodes: WorkspaceGraphNode[] = [
    {
      id: 'asset-product-image',
      type: 'asset-image',
      position: { x: -330, y: -220 },
      data: {
        kind: 'asset-image',
        title: 'Product Image',
        subtitle: 'chrono_watch.png',
        accent: '#8b5cf6',
        asset: {
          id: 'product-image',
          kind: 'image',
          filename: 'chrono_watch.png',
          subtitle: 'Image · 2048x2048',
          url: '/storyboard/examples/storyboarder-product-reference.jpg',
          thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
          dimensions: '2048x2048',
        },
        sourceHandles: ['reference'],
      },
    },
    {
      id: 'asset-style-reference',
      type: 'asset-video',
      position: { x: -330, y: -50 },
      data: {
        kind: 'asset-video',
        title: 'Style Reference',
        subtitle: 'product_turntable.mp4',
        accent: '#d946ef',
        asset: {
          id: 'style-video',
          kind: 'video',
          filename: 'product_turntable.mp4',
          subtitle: 'Video · 12s',
          url: '/hero/pika-22.mp4',
          thumbUrl: '/hero/kling-3-4k-demo.jpg',
          durationSec: 12,
        },
        sourceHandles: ['video_reference'],
      },
    },
    {
      id: 'prompt-camera',
      type: 'text-prompt',
      position: { x: -330, y: 145 },
      data: {
        kind: 'text-prompt',
        title: 'Camera Movement',
        subtitle: 'camera_move.txt',
        accent: '#38bdf8',
        promptRole: 'camera',
        promptText: 'Smooth cinematic orbit around product, slow push in, premium macro lighting.',
        sourceHandles: ['prompt'],
      },
    },
    {
      id: 'audio-music-01',
      type: 'asset-audio',
      position: { x: -380, y: 350 },
      data: {
        kind: 'asset-audio',
        title: 'Audio Reference',
        subtitle: 'ambient_moody.mp3',
        accent: '#22c55e',
        asset: {
          id: 'ambient-music',
          kind: 'audio',
          filename: 'ambient_moody.mp3',
          subtitle: 'Audio · 28s',
          url: WORKSPACE_DEMO_AUDIO_URL,
          durationSec: 28,
        },
        sourceHandles: ['audio'],
      },
    },
    {
      id: 'shot-01',
      type: 'shot',
      position: { x: -20, y: -220 },
      data: {
        kind: 'shot',
        title: 'Shot 01',
        subtitle: 'Hero Reveal',
        accent: '#8b5cf6',
        shot: shotSettings({ outputName: 'Hero Reveal', modelId: 'kling-3-pro', durationSec: PRODUCT_AD_SHOT_01_DURATION_SEC }),
        targetHandles: ['prompt', 'start_image', 'reference', 'camera', 'previous_shot'],
        sourceHandles: ['generated_output'],
      },
    },
    {
      id: 'output-01',
      type: 'output',
      position: { x: 220, y: -220 },
      data: {
        kind: 'output',
        title: 'Output 01',
        subtitle: '5s · 16:9',
        accent: '#f97316',
        output: {
          kind: 'video',
          modelId: 'kling-3-pro',
          modelLabel: 'Kling 3 Pro',
          workflowType: 'image_to_video',
          durationSec: PRODUCT_AD_SHOT_01_DURATION_SEC,
          aspectRatio: '16:9',
          resolution: '1080p',
          createdAt: new Date('2026-06-05T09:00:00.000Z').toISOString(),
          sourceShotId: 'shot-01',
          thumbUrl: '/hero/showcase-kling-3-pro.webp',
          url: '/hero/pika-22.mp4',
          jobId: 'template-output-01',
        },
        targetHandles: ['generated_output'],
        sourceHandles: ['video_reference'],
      },
    },
    {
      id: 'shot-02',
      type: 'shot',
      position: { x: 460, y: -220 },
      data: {
        kind: 'shot',
        title: 'Shot 02',
        subtitle: 'Macro Details',
        accent: '#3b82f6',
        shot: shotSettings({ outputName: 'Macro Details', modelId: 'veo-3-1', durationSec: PRODUCT_AD_SHOT_02_DURATION_SEC }),
        targetHandles: ['prompt', 'start_image', 'reference', 'camera', 'previous_shot'],
        sourceHandles: ['generated_output'],
      },
    },
    {
      id: 'output-02',
      type: 'output',
      position: { x: 700, y: -220 },
      data: {
        kind: 'output',
        title: 'Output 02',
        subtitle: '8s · 16:9',
        accent: '#3b82f6',
        output: {
          kind: 'video',
          modelId: 'veo-3-1',
          modelLabel: 'Veo 3.1',
          workflowType: 'image_to_video',
          durationSec: PRODUCT_AD_SHOT_02_DURATION_SEC,
          aspectRatio: '16:9',
          resolution: '1080p',
          createdAt: new Date('2026-06-05T09:03:00.000Z').toISOString(),
          sourceShotId: 'shot-02',
          thumbUrl: '/hero/showcase-veo-3-1.webp',
          url: '/hero/veo3.mp4',
          hasAudio: true,
          jobId: 'template-output-02',
        },
        targetHandles: ['generated_output'],
        sourceHandles: ['video_reference'],
      },
    },
    {
      id: 'shot-03',
      type: 'shot',
      position: { x: -20, y: 180 },
      data: {
        kind: 'shot',
        title: 'Shot 03',
        subtitle: 'Exploded View',
        accent: '#22c55e',
        shot: shotSettings({ outputName: 'Exploded View', modelId: 'veo-3-1', durationSec: 7 }),
        targetHandles: ['prompt', 'start_image', 'reference', 'camera', 'previous_shot'],
        sourceHandles: ['generated_output'],
      },
    },
    {
      id: 'shot-04',
      type: 'shot',
      position: { x: 460, y: 180 },
      data: {
        kind: 'shot',
        title: 'Shot 04',
        subtitle: 'Final Packshot',
        accent: '#f97316',
        shot: shotSettings({ outputName: 'Final Packshot', modelId: 'kling-3-pro', durationSec: 7 }),
        targetHandles: ['prompt', 'start_image', 'reference', 'logo', 'camera', 'previous_shot', 'narration'],
        sourceHandles: ['generated_output'],
      },
    },
    {
      id: 'asset-logo',
      type: 'asset-image',
      position: { x: 700, y: 245 },
      data: {
        kind: 'asset-image',
        title: 'Logo',
        subtitle: 'brand_logo.png',
        accent: '#facc15',
        asset: {
          id: 'brand-logo',
          kind: 'logo',
          filename: 'brand_logo.png',
          subtitle: 'Logo · 1024x1024',
          thumbUrl: '/assets/branding/logo-mark.svg',
          url: '/assets/branding/logo-mark.svg',
        },
        sourceHandles: ['reference'],
      },
    },
    {
      id: 'prompt-voiceover',
      type: 'text-prompt',
      position: { x: 640, y: 25 },
      data: {
        kind: 'text-prompt',
        title: 'Voice Over',
        subtitle: 'vo_final.txt',
        accent: '#14b8a6',
        promptRole: 'narration',
        promptText: 'Precision in motion. A modern chronograph built for every second that matters.',
        sourceHandles: ['prompt'],
      },
    },
  ];

  const edges: WorkspaceGraphEdge[] = [
    createWorkspaceEdge({ source: 'asset-product-image', target: 'shot-01', sourceHandle: 'reference', targetHandle: 'start_image', kind: 'start_image' }),
    createWorkspaceEdge({ source: 'asset-style-reference', target: 'shot-01', sourceHandle: 'video_reference', targetHandle: 'reference', kind: 'reference' }),
    createWorkspaceEdge({ source: 'prompt-camera', target: 'shot-01', sourceHandle: 'prompt', targetHandle: 'camera', kind: 'camera' }),
    createWorkspaceEdge({ source: 'shot-01', target: 'output-01', kind: 'generated_output' }),
    createWorkspaceEdge({ source: 'output-01', target: 'shot-02', sourceHandle: 'video_reference', targetHandle: 'previous_shot', kind: 'previous_shot' }),
    createWorkspaceEdge({ source: 'asset-product-image', target: 'shot-02', sourceHandle: 'reference', targetHandle: 'start_image', kind: 'start_image' }),
    createWorkspaceEdge({ source: 'prompt-camera', target: 'shot-02', sourceHandle: 'prompt', targetHandle: 'camera', kind: 'camera' }),
    createWorkspaceEdge({ source: 'shot-02', target: 'output-02', kind: 'generated_output' }),
    createWorkspaceEdge({ source: 'output-01', target: 'shot-03', sourceHandle: 'video_reference', targetHandle: 'previous_shot', kind: 'previous_shot' }),
    createWorkspaceEdge({ source: 'asset-product-image', target: 'shot-03', sourceHandle: 'reference', targetHandle: 'start_image', kind: 'start_image' }),
    createWorkspaceEdge({ source: 'asset-style-reference', target: 'shot-03', sourceHandle: 'video_reference', targetHandle: 'reference', kind: 'reference' }),
    createWorkspaceEdge({ source: 'prompt-camera', target: 'shot-03', sourceHandle: 'prompt', targetHandle: 'camera', kind: 'camera' }),
    createWorkspaceEdge({ source: 'shot-03', target: 'shot-04', sourceHandle: 'generated_output', targetHandle: 'previous_shot', kind: 'continuity' }),
    createWorkspaceEdge({ source: 'asset-product-image', target: 'shot-04', sourceHandle: 'reference', targetHandle: 'start_image', kind: 'start_image' }),
    createWorkspaceEdge({ source: 'prompt-camera', target: 'shot-04', sourceHandle: 'prompt', targetHandle: 'camera', kind: 'camera' }),
    createWorkspaceEdge({ source: 'asset-logo', target: 'shot-04', sourceHandle: 'reference', targetHandle: 'logo', kind: 'logo' }),
    createWorkspaceEdge({ source: 'prompt-voiceover', target: 'shot-04', sourceHandle: 'prompt', targetHandle: 'narration', kind: 'narration' }),
  ];

  return {
    id: 'product-ad',
    name: 'Product Ad',
    nodes,
    edges,
    timelineItems: productAdTimeline(),
  };
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

type WorkspaceTemplateVariantConfig = {
  productTitle: string;
  productFilename: string;
  productUrl: string;
  productDimensions: string;
  styleTitle: string;
  styleFilename: string;
  styleThumbUrl: string;
  promptTitle: string;
  promptSubtitle: string;
  promptRole: WorkspacePromptRole;
  promptText: string;
  voiceTitle: string;
  voiceText: string;
  audioTitle: string;
  audioFilename: string;
  shotSubtitles: [string, string, string, string];
  outputThumbs: [string, string];
  timelineTitles: [string, string];
};

const WORKSPACE_TEMPLATE_VARIANTS: Partial<Record<WorkspaceTemplateId, WorkspaceTemplateVariantConfig>> = {
  'character-dialogue': {
    productTitle: 'Character Anchor',
    productFilename: 'character_anchor.png',
    productUrl: '/assets/blog/character-builder/consistent-character-portrait-anchor.webp',
    productDimensions: '1024x1536',
    styleTitle: 'Performance Reference',
    styleFilename: 'dialogue_tone.mp4',
    styleThumbUrl: '/assets/blog/character-builder/ai-character-sheet-portrait-anchor.webp',
    promptTitle: 'Dialogue Direction',
    promptSubtitle: 'dialogue_prompt.txt',
    promptRole: 'dialogue',
    promptText: 'A close, emotional two-line exchange. Keep the same character identity, soft eye movement, natural pauses, and grounded delivery.',
    voiceTitle: 'Voice Cue',
    voiceText: 'A quiet but decisive voiceover that bridges both shots without breaking character continuity.',
    audioTitle: 'Room Tone',
    audioFilename: 'dialogue_room_tone.wav',
    shotSubtitles: ['Character Close-up', 'Reverse Angle', 'Reaction Beat', 'Final Line'],
    outputThumbs: ['/assets/blog/character-builder/consistent-character-portrait-anchor.webp', '/hero/showcase-veo-3-1.webp'],
    timelineTitles: ['Dialogue Close-up', 'Reaction Beat'],
  },
  'storyboard-to-video': {
    productTitle: 'Storyboard Frames',
    productFilename: 'six_panel_board.png',
    productUrl: '/storyboard/templates/storyboard-template-6.png',
    productDimensions: '1920x1080',
    styleTitle: 'Motion Board',
    styleFilename: 'animatic_reference.mp4',
    styleThumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
    promptTitle: 'Panel Continuity',
    promptSubtitle: 'panel_timing.txt',
    promptRole: 'camera',
    promptText: 'Follow the storyboard order exactly. Use each panel as a beat, preserve screen direction, and make transitions feel like a planned animatic.',
    voiceTitle: 'Scene Notes',
    voiceText: 'Use the storyboard as timing authority: establish, push in, action beat, detail, transition, end frame.',
    audioTitle: 'Temp Score',
    audioFilename: 'storyboard_temp_score.mp3',
    shotSubtitles: ['Panel 01 Establish', 'Panel 02 Action', 'Panel 03 Insert', 'Panel 04 End Frame'],
    outputThumbs: ['/storyboard/templates/storyboard-template-6.png', '/hero/showcase-seedance-2-0.webp'],
    timelineTitles: ['Storyboard Beat 01', 'Storyboard Beat 02'],
  },
  'ugc-ad': {
    productTitle: 'Creator Reference',
    productFilename: 'creator_anchor.png',
    productUrl: '/assets/tools/character-builder-workspace.png',
    productDimensions: '1400x900',
    styleTitle: 'B-roll Reference',
    styleFilename: 'ugc_broll_style.mp4',
    styleThumbUrl: '/hero/best-for-fast-drafts-city.webp',
    promptTitle: 'Hook Script',
    promptSubtitle: 'ugc_hook.txt',
    promptRole: 'prompt',
    promptText: 'Open with a direct hook, show the product in use, cut to one proof point, then close with a clean visual payoff.',
    voiceTitle: 'Creator VO',
    voiceText: 'Conversational voiceover: fast hook, believable benefit, no over-polished ad language.',
    audioTitle: 'Social Bed',
    audioFilename: 'ugc_social_bed.mp3',
    shotSubtitles: ['Hook Opener', 'Product Proof', 'B-roll Detail', 'CTA Moment'],
    outputThumbs: ['/hero/best-for-fast-drafts-city.webp', '/assets/tools/character-builder-workspace.png'],
    timelineTitles: ['UGC Hook', 'Proof B-roll'],
  },
  'cinematic-scene': {
    productTitle: 'Mood Plate',
    productFilename: 'cinematic_mood.png',
    productUrl: '/hero/best-for-cinematic-realism.webp',
    productDimensions: '1920x1080',
    styleTitle: 'Camera Language',
    styleFilename: 'trailer_motion_ref.mp4',
    styleThumbUrl: '/hero/kling-3-4k-demo.jpg',
    promptTitle: 'Scene Prompt',
    promptSubtitle: 'trailer_scene.txt',
    promptRole: 'scene_description',
    promptText: 'Build a cinematic trailer beat: wide establishing image, controlled camera push, character reveal, atmosphere, and dramatic final frame.',
    voiceTitle: 'Trailer VO',
    voiceText: 'Sparse narration with tension: one line before the reveal, one line on the final frame.',
    audioTitle: 'Trailer Pulse',
    audioFilename: 'trailer_pulse.wav',
    shotSubtitles: ['Wide Establishing', 'Character Reveal', 'Action Insert', 'Final Frame'],
    outputThumbs: ['/hero/best-for-cinematic-realism.webp', '/hero/showcase-kling-3-pro.webp'],
    timelineTitles: ['Trailer Establish', 'Trailer Reveal'],
  },
};

function createVariantWorkspaceTemplate(templateId: WorkspaceTemplateId, summary: WorkspaceTemplateSummary): WorkspaceTemplate {
  const config = WORKSPACE_TEMPLATE_VARIANTS[templateId];
  const base = createProductAdWorkspaceTemplate();
  if (!config) {
    return {
      ...base,
      id: summary.id,
      name: summary.name,
    };
  }

  const nodes = base.nodes.map((node) => {
    if (node.id === 'asset-product-image') {
      return {
        ...node,
        data: {
          ...node.data,
          title: config.productTitle,
          subtitle: config.productFilename,
          accent: summary.accent ?? node.data.accent,
          asset: {
            ...node.data.asset,
            id: `${templateId}-primary-reference`,
            kind: 'image' as const,
            filename: config.productFilename,
            subtitle: `Image · ${config.productDimensions}`,
            url: config.productUrl,
            thumbUrl: config.productUrl,
            dimensions: config.productDimensions,
          },
        },
      };
    }
    if (node.id === 'asset-style-reference') {
      return {
        ...node,
        data: {
          ...node.data,
          title: config.styleTitle,
          subtitle: config.styleFilename,
          asset: {
            ...node.data.asset,
            id: `${templateId}-style-reference`,
            kind: 'video' as const,
            filename: config.styleFilename,
            subtitle: 'Video · reference',
            thumbUrl: config.styleThumbUrl,
          },
        },
      };
    }
    if (node.id === 'prompt-camera') {
      return {
        ...node,
        data: {
          ...node.data,
          title: config.promptTitle,
          subtitle: config.promptSubtitle,
          promptRole: config.promptRole,
          promptText: config.promptText,
        },
      };
    }
    if (node.id === 'audio-music-01') {
      return {
        ...node,
        data: {
          ...node.data,
          title: config.audioTitle,
          subtitle: config.audioFilename,
          asset: {
            ...node.data.asset,
            id: `${templateId}-audio-reference`,
            kind: 'audio' as const,
            filename: config.audioFilename,
            subtitle: 'Audio · reference',
          },
        },
      };
    }
    if (node.id === 'prompt-voiceover') {
      return {
        ...node,
        data: {
          ...node.data,
          title: config.voiceTitle,
          promptText: config.voiceText,
        },
      };
    }
    if (node.id.startsWith('shot-')) {
      const shotIndex = Number(node.id.replace('shot-0', '')) - 1;
      const subtitle = config.shotSubtitles[shotIndex] ?? summary.name;
      return {
        ...node,
        data: {
          ...node.data,
          subtitle,
          shot: {
            ...(node.data.shot as WorkspaceShotSettings),
            outputName: subtitle,
          },
        },
      };
    }
    if (node.id === 'output-01' || node.id === 'output-02') {
      const outputIndex = node.id === 'output-01' ? 0 : 1;
      return {
        ...node,
        data: {
          ...node.data,
          output: node.data.output
            ? {
                ...node.data.output,
                thumbUrl: config.outputThumbs[outputIndex],
                modelLabel: node.id === 'output-01' ? 'Seedance 2.0' : node.data.output.modelLabel,
              }
            : node.data.output,
        },
      };
    }
    return node;
  });

  return {
    ...base,
    id: summary.id,
    name: summary.name,
    nodes,
    timelineItems: base.timelineItems.map((item) => {
      if (item.id === 'timeline-output-01') {
        return { ...item, title: config.timelineTitles[0], thumbnailUrl: config.outputThumbs[0] };
      }
      if (item.id === 'timeline-output-02' || item.id === 'timeline-output-02-audio') {
        return { ...item, title: item.mediaKind === 'audio' ? `${config.timelineTitles[1]} Audio` : config.timelineTitles[1], thumbnailUrl: config.outputThumbs[1] };
      }
      if (item.id === 'timeline-music-01') {
        return { ...item, title: config.audioFilename };
      }
      return item;
    }),
  };
}

export function createStarterWorkspaceTemplate(templateId: WorkspaceTemplateId): WorkspaceTemplate {
  if (templateId === 'dev-blocks') return createDevBlocksWorkspaceTemplate();
  if (templateId === 'product-ad') return createProductAdWorkspaceTemplate();
  const summary = WORKSPACE_TEMPLATE_SUMMARIES.find((entry) => entry.id === templateId) ?? WORKSPACE_TEMPLATE_SUMMARIES[0];
  return createVariantWorkspaceTemplate(templateId, summary);
}
