import type {
  WorkspaceEdgeKind,
  WorkspaceGeneratedCopyField,
  WorkspaceGeneratedCopyReference,
  WorkspaceGraphNode,
  WorkspaceNodeGeneratedCopy,
  WorkspaceTemplate,
  WorkspaceTimelineItem,
  WorkspaceTimelineItemGeneratedCopy,
} from './workspace-types';
import {
  localizeStudioEdgeKindLabel,
  localizeStudioGeneratedCanvasText,
  type StudioCopy,
} from '../../_lib/studio-copy';
import { getWorkspaceBlockPreset } from './workspace-block-presets';

function formatGeneratedCopyValue(
  value: string,
  replacements?: Record<string, string | number>,
  edgeKindReplacements?: Record<string, WorkspaceEdgeKind>,
  lowercaseEdgeKindReplacements?: Record<string, WorkspaceEdgeKind>,
  copy?: StudioCopy['canvas']['nodes']
): string {
  const resolvedReplacements: Record<string, string | number> = { ...(replacements ?? {}) };
  if (copy) {
    Object.entries(edgeKindReplacements ?? {}).forEach(([key, kind]) => {
      resolvedReplacements[key] = localizeStudioEdgeKindLabel(kind, copy);
    });
    Object.entries(lowercaseEdgeKindReplacements ?? {}).forEach(([key, kind]) => {
      resolvedReplacements[key] = localizeStudioEdgeKindLabel(kind, copy).toLocaleLowerCase();
    });
  }
  if (!Object.keys(resolvedReplacements).length) return value;
  return Object.entries(resolvedReplacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function generatedCopyReference(
  key: keyof StudioCopy['canvas']['nodes'] & string,
  replacements?: Record<string, string | number>,
  edgeKindReplacements?: Record<string, WorkspaceEdgeKind>,
  lowercaseEdgeKindReplacements?: Record<string, WorkspaceEdgeKind>
): WorkspaceGeneratedCopyReference {
  return {
    key,
    ...(replacements ? { replacements } : {}),
    ...(edgeKindReplacements ? { edgeKindReplacements } : {}),
    ...(lowercaseEdgeKindReplacements ? { lowercaseEdgeKindReplacements } : {}),
  };
}

export function generatedTextReference(value: string): WorkspaceGeneratedCopyReference {
  return { value };
}

export function localizeWorkspaceGeneratedCopyReference(
  reference: WorkspaceGeneratedCopyReference,
  copy: StudioCopy['canvas']['nodes'],
  fallback: string
): string {
  if ('value' in reference && typeof reference.value === 'string') {
    return localizeStudioGeneratedCanvasText(reference.value, copy);
  }
  const value = copy[reference.key];
  return typeof value === 'string'
    ? formatGeneratedCopyValue(
      value,
      reference.replacements,
      reference.edgeKindReplacements,
      reference.lowercaseEdgeKindReplacements,
      copy
    )
    : fallback;
}

export function localizeWorkspaceNodeGeneratedText(
  value: string | undefined,
  reference: WorkspaceGeneratedCopyField | undefined,
  copy: StudioCopy['canvas']['nodes']
): string | undefined {
  if (typeof value !== 'string') return value;
  return reference ? localizeWorkspaceGeneratedCopyReference(reference, copy, value) : value;
}

export function localizeWorkspaceNodeTitle(
  node: WorkspaceGraphNode,
  copy: StudioCopy['canvas']['nodes']
): string {
  const preset = getWorkspaceBlockPreset(node.data.shot?.presetId);
  const titleReference = node.data.generatedCopy?.title ?? (
    preset ? generatedCopyReference(preset.titleKey as keyof StudioCopy['canvas']['nodes'] & string) : undefined
  );
  return localizeWorkspaceNodeGeneratedText(node.data.title, titleReference, copy) ?? node.data.title;
}

export function localizeWorkspaceNodeSubtitle(
  node: WorkspaceGraphNode,
  copy: StudioCopy['canvas']['nodes']
): string | undefined {
  const preset = getWorkspaceBlockPreset(node.data.shot?.presetId);
  const subtitleReference = node.data.generatedCopy?.subtitle ?? (
    preset ? generatedCopyReference(preset.subtitleKey as keyof StudioCopy['canvas']['nodes'] & string) : undefined
  );
  return localizeWorkspaceNodeGeneratedText(node.data.subtitle, subtitleReference, copy);
}

export function localizeWorkspacePromptText(
  node: WorkspaceGraphNode,
  copy: StudioCopy['canvas']['nodes']
): string | undefined {
  return localizeWorkspaceNodeGeneratedText(node.data.promptText, node.data.generatedCopy?.promptText, copy);
}

export function localizeWorkspaceShotOutputName(
  node: WorkspaceGraphNode,
  copy: StudioCopy['canvas']['nodes']
): string {
  const outputName = node.data.shot?.outputName ?? '';
  return localizeWorkspaceNodeGeneratedText(outputName, node.data.generatedCopy?.shotOutputName, copy) ?? outputName;
}

export function localizeWorkspaceTimelineItemTitle(
  item: WorkspaceTimelineItem,
  copy: StudioCopy['canvas']['nodes']
): string {
  return localizeWorkspaceNodeGeneratedText(item.title, item.generatedCopy?.title, copy) ?? item.title;
}

export function workspaceOutputNodeTitleDataForShot(
  shotNode: WorkspaceGraphNode
): {
  title: string;
  generatedCopy?: WorkspaceNodeGeneratedCopy;
} {
  const title = shotNode.data.shot?.outputName ?? shotNode.data.title;
  const titleReference = shotNode.data.generatedCopy?.shotOutputName;
  return {
    title,
    generatedCopy: titleReference ? { title: titleReference } : undefined,
  };
}

export function localizeWorkspaceAssetSubtitle(
  value: string,
  copy: StudioCopy['canvas']['nodes'] | null | undefined
): string {
  if (!copy) return value;
  const match = /^(Image|Video|Audio) · (.+)$/.exec(value);
  if (!match) return value;

  const kind = match[1] as 'Image' | 'Video' | 'Audio';
  const detail = match[2];
  const localizedKind =
    kind === 'Image'
      ? copy.image
      : kind === 'Video'
        ? copy.video
        : copy.audio;
  const localizedDetail = detail === 'reference' ? copy.edgeReference : detail;
  return `${localizedKind} · ${localizedDetail}`;
}

export function localizeWorkspaceTemplateGeneratedState(
  template: WorkspaceTemplate,
  copy?: StudioCopy['canvas']['nodes']
): WorkspaceTemplate {
  if (!copy) return template;
  return {
    ...template,
    nodes: template.nodes.map((node) => {
      const promptText = localizeWorkspacePromptText(node, copy);
      const shotOutputName = localizeWorkspaceShotOutputName(node, copy);
      return {
        ...node,
        data: {
          ...node.data,
          title: localizeWorkspaceNodeTitle(node, copy),
          subtitle: localizeWorkspaceNodeSubtitle(node, copy) ?? node.data.subtitle,
          ...(typeof promptText === 'string' ? { promptText } : {}),
          ...(node.data.shot
            ? {
                shot: {
                  ...node.data.shot,
                  outputName: shotOutputName,
                },
              }
            : {}),
        },
      };
    }),
    timelineItems: template.timelineItems.map((item) => ({
      ...item,
      title: localizeWorkspaceTimelineItemTitle(item, copy),
    })),
  };
}

export function clearWorkspaceGeneratedCopyReferences(
  generatedCopy: WorkspaceNodeGeneratedCopy | undefined,
  fields: Array<keyof WorkspaceNodeGeneratedCopy>
): WorkspaceNodeGeneratedCopy | undefined {
  const nextGeneratedCopy: WorkspaceNodeGeneratedCopy = { ...(generatedCopy ?? {}) };
  fields.forEach((field) => {
    nextGeneratedCopy[field] = null;
  });
  return nextGeneratedCopy;
}

export function clearWorkspaceTimelineItemGeneratedCopyReferences(
  generatedCopy: WorkspaceTimelineItemGeneratedCopy | undefined,
  fields: Array<keyof WorkspaceTimelineItemGeneratedCopy>
): WorkspaceTimelineItemGeneratedCopy | undefined {
  const nextGeneratedCopy: WorkspaceTimelineItemGeneratedCopy = { ...(generatedCopy ?? {}) };
  fields.forEach((field) => {
    nextGeneratedCopy[field] = null;
  });
  return nextGeneratedCopy;
}
