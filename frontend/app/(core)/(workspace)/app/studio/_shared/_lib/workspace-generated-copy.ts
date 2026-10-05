import type {WorkspaceEdgeKind,WorkspaceGeneratedCopyField,WorkspaceGeneratedCopyReference,WorkspaceTimelineItem} from './workspace-types';
import {localizeStudioEdgeKindLabel,localizeStudioGeneratedCanvasText,type StudioCopy} from '../../_lib/studio-copy';
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

export function localizeWorkspaceTimelineItemTitle(
  item: WorkspaceTimelineItem,
  copy: StudioCopy['canvas']['nodes']
): string {
  return localizeWorkspaceNodeGeneratedText(item.title, item.generatedCopy?.title, copy) ?? item.title;
}

export function generatedTextReference(value: string): WorkspaceGeneratedCopyReference {
  return {value};
}
