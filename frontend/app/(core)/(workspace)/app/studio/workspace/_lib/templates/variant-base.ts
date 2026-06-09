import type { WorkspacePromptRole, WorkspaceShotSettings, WorkspaceTemplate, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../workspace-types';
import { createProductAdWorkspaceTemplate } from './product-ad';

export type WorkspaceTemplateVariantConfig = {
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


export function createVariantWorkspaceTemplate(templateId: WorkspaceTemplateId, summary: WorkspaceTemplateSummary, config: WorkspaceTemplateVariantConfig): WorkspaceTemplate {
  const base = createProductAdWorkspaceTemplate();

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

