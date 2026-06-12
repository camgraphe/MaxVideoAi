import type { WorkspacePromptRole, WorkspaceShotSettings, WorkspaceTemplate, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../workspace-types';
import {
  generatedCopyReference,
  generatedTextReference,
  localizeWorkspaceTemplateGeneratedState,
} from '../workspace-generated-copy';
import { createProductAdWorkspaceTemplate } from './product-ad';
import type { WorkspaceTemplateBuildCopy } from './registry';
import type { StudioCanvasNodeCopyKey } from '../../../_lib/studio-copy';

export type WorkspaceTemplateVariantConfig = {
  productTitle: string;
  productTitleCopyKey: StudioCanvasNodeCopyKey;
  productFilename: string;
  productUrl: string;
  productDimensions: string;
  styleTitle: string;
  styleTitleCopyKey: StudioCanvasNodeCopyKey;
  styleFilename: string;
  styleThumbUrl: string;
  promptTitle: string;
  promptTitleCopyKey: StudioCanvasNodeCopyKey;
  promptSubtitle: string;
  promptRole: WorkspacePromptRole;
  promptText: string;
  promptTextCopyKey: StudioCanvasNodeCopyKey;
  voiceTitle: string;
  voiceTitleCopyKey: StudioCanvasNodeCopyKey;
  voiceText: string;
  voiceTextCopyKey: StudioCanvasNodeCopyKey;
  audioTitle: string;
  audioTitleCopyKey: StudioCanvasNodeCopyKey;
  audioFilename: string;
  shotSubtitles: [string, string, string, string];
  shotSubtitleCopyKeys: [StudioCanvasNodeCopyKey, StudioCanvasNodeCopyKey, StudioCanvasNodeCopyKey, StudioCanvasNodeCopyKey];
  outputThumbs: [string, string];
  timelineTitles: [string, string];
  timelineTitleCopyKeys: [StudioCanvasNodeCopyKey, StudioCanvasNodeCopyKey];
};

export function createVariantWorkspaceTemplate(
  templateId: WorkspaceTemplateId,
  summary: WorkspaceTemplateSummary,
  config: WorkspaceTemplateVariantConfig,
  copy?: WorkspaceTemplateBuildCopy
): WorkspaceTemplate {
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
          generatedCopy: {
            ...node.data.generatedCopy,
            title: generatedCopyReference(config.productTitleCopyKey),
          },
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
          generatedCopy: {
            ...node.data.generatedCopy,
            title: generatedCopyReference(config.styleTitleCopyKey),
          },
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
          generatedCopy: {
            ...node.data.generatedCopy,
            title: generatedCopyReference(config.promptTitleCopyKey),
            promptText: generatedCopyReference(config.promptTextCopyKey),
          },
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
          generatedCopy: {
            ...node.data.generatedCopy,
            title: generatedCopyReference(config.audioTitleCopyKey),
          },
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
          generatedCopy: {
            ...node.data.generatedCopy,
            title: generatedCopyReference(config.voiceTitleCopyKey),
            promptText: generatedCopyReference(config.voiceTextCopyKey),
          },
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
          generatedCopy: {
            ...node.data.generatedCopy,
            subtitle: generatedCopyReference(config.shotSubtitleCopyKeys[shotIndex]),
            shotOutputName: generatedCopyReference(config.shotSubtitleCopyKeys[shotIndex]),
          },
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

  return localizeWorkspaceTemplateGeneratedState({
    ...base,
    id: summary.id,
    name: summary.name,
    nodes,
    timelineItems: base.timelineItems.map((item) => {
      if (item.id === 'timeline-output-01') {
        return {
          ...item,
          title: config.timelineTitles[0],
          generatedCopy: {
            title: generatedCopyReference(config.timelineTitleCopyKeys[0]),
          },
          thumbnailUrl: config.outputThumbs[0],
        };
      }
      if (item.id === 'timeline-output-02' || item.id === 'timeline-output-02-audio') {
        const title = item.mediaKind === 'audio' ? `${config.timelineTitles[1]} Audio` : config.timelineTitles[1];
        return {
          ...item,
          title,
          generatedCopy: {
            title: item.mediaKind === 'audio'
              ? generatedTextReference(title)
              : generatedCopyReference(config.timelineTitleCopyKeys[1]),
          },
          thumbnailUrl: config.outputThumbs[1],
        };
      }
      if (item.id === 'timeline-music-01') {
        return { ...item, title: config.audioFilename };
      }
      return item;
    }),
  }, copy);
}
