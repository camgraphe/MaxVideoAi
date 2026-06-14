import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { createStarterWorkspaceTemplate, WORKSPACE_TEMPLATE_SUMMARIES } from '../_lib/workspace-templates';
import type {
  CanvasGraphHistorySnapshot,
  WorkspaceEditorSurface,
  WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceTemplateId,
} from '../_lib/workspace-types';
import {
  describeCanvasTemplate,
} from '../_state/workspace-api-persistence';
import type { StudioCopy } from '../../_lib/studio-copy';

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function cloneWorkspaceJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createLocalCanvasTemplateId(): string {
  if (globalThis.crypto?.randomUUID) return `canvas_template_${globalThis.crypto.randomUUID()}`;
  return `canvas_template_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createAdditiveTemplateGraphId(templateId: WorkspaceTemplateId): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `template_${templateId}_${randomId}`;
}

function starterTemplateNoticeName(
  templateId: WorkspaceTemplateId,
  fallbackName: string,
  templateSummariesCopy: StudioCopy['canvas']['templateSummaries']
): string {
  const summary = WORKSPACE_TEMPLATE_SUMMARIES.find((candidate) => candidate.id === templateId);
  const localized = templateSummariesCopy[templateId];
  return localized?.name || summary?.name || fallbackName;
}

function graphNodeBounds(nodes: WorkspaceGraphNode[]): { minX: number; minY: number; maxX: number } | null {
  if (!nodes.length) return null;
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + (node.width ?? node.measured?.width ?? 240)),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY }
  );
}

function offsetTemplateNodes({
  currentNodes,
  templateNodes,
}: {
  currentNodes: WorkspaceGraphNode[];
  templateNodes: WorkspaceGraphNode[];
}): WorkspaceGraphNode[] {
  const currentBounds = graphNodeBounds(currentNodes);
  const templateBounds = graphNodeBounds(templateNodes);
  if (!currentBounds || !templateBounds) return templateNodes;
  const gap = 220;
  const offsetX = currentBounds.maxX + gap - templateBounds.minX;
  const offsetY = currentBounds.minY - templateBounds.minY;
  return templateNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));
}

function remapStarterTemplateGraph(templateId: WorkspaceTemplateId, template: { nodes: WorkspaceGraphNode[]; edges: WorkspaceGraphEdge[] }) {
  const instanceId = createAdditiveTemplateGraphId(templateId);
  const nodeIdMap = new Map(template.nodes.map((node) => [node.id, `${instanceId}_${node.id}`]));
  const nextNodes = template.nodes.map((node) => ({
    ...cloneWorkspaceJson(node),
    id: nodeIdMap.get(node.id) ?? `${instanceId}_${node.id}`,
    selected: false,
  }));
  const nextEdges = template.edges.map((edge) => ({
    ...cloneWorkspaceJson(edge),
    id: `${instanceId}_${edge.id}`,
    source: nodeIdMap.get(edge.source) ?? edge.source,
    target: nodeIdMap.get(edge.target) ?? edge.target,
    selected: false,
  }));
  return {
    edges: nextEdges,
    nodes: nextNodes,
  };
}

type UseWorkspaceCanvasTemplateActionsParams = {
  activeUserCanvasTemplateId: string | null;
  commitCanvasGraph: (
    updater: (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setActiveTemplateId: Dispatch<SetStateAction<WorkspaceTemplateId>>;
  setActiveUserCanvasTemplateId: Dispatch<SetStateAction<string | null>>;
  setCanvasRevision: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setUserCanvasTemplates: Dispatch<SetStateAction<WorkspaceUserCanvasTemplate[]>>;
  studioCanvasCopy: StudioCopy['canvas'];
  studioNotices: StudioCopy['notices'];
  userCanvasTemplates: WorkspaceUserCanvasTemplate[];
};

export function useWorkspaceCanvasTemplateActions({
  activeUserCanvasTemplateId,
  commitCanvasGraph,
  edges,
  nodes,
  setActiveEditorSurface,
  setActiveTemplateId,
  setActiveUserCanvasTemplateId,
  setCanvasRevision,
  setNotice,
  setSelectedNodeId,
  setUserCanvasTemplates,
  studioCanvasCopy,
  studioNotices,
  userCanvasTemplates,
}: UseWorkspaceCanvasTemplateActionsParams): {
  handleAddCanvasTemplate: (templateId: WorkspaceTemplateId) => void;
  handleApplyCanvasTemplate: (templateId: WorkspaceTemplateId) => void;
  handleApplyUserCanvasTemplate: (templateId: string) => void;
  handleCreateCanvasFromTemplate: (templateId: WorkspaceTemplateId) => void;
  handleDeleteUserCanvasTemplate: (templateId: string) => void;
  handleDuplicateUserCanvasTemplate: (templateId: string) => void;
  handleRenameUserCanvasTemplate: (templateId: string, name: string) => void;
  handleSaveActiveCanvasTemplate: () => void;
  handleSaveCanvasTemplate: (name: string) => void;
} {
  const updateUserCanvasTemplates = useCallback(
    (updater: (templates: WorkspaceUserCanvasTemplate[]) => WorkspaceUserCanvasTemplate[]) => {
      setUserCanvasTemplates((currentTemplates) => {
        return updater(currentTemplates);
      });
    },
    [setUserCanvasTemplates]
  );

  const handleApplyCanvasTemplate = useCallback(
    (templateId: WorkspaceTemplateId) => {
      const template = createStarterWorkspaceTemplate(templateId);
      commitCanvasGraph(() => ({
        edges: template.edges,
        nodes: template.nodes,
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(null);
      setActiveTemplateId(template.id);
      setActiveUserCanvasTemplateId(null);
      setCanvasRevision((value) => value + 1);
      setNotice(formatCopyValue(studioNotices.canvasTemplateApplied, {
        name: starterTemplateNoticeName(template.id, template.name, studioCanvasCopy.templateSummaries),
      }));
    },
    [commitCanvasGraph, setActiveEditorSurface, setActiveTemplateId, setActiveUserCanvasTemplateId, setCanvasRevision, setNotice, setSelectedNodeId, studioCanvasCopy.templateSummaries, studioNotices.canvasTemplateApplied]
  );

  const saveCanvasSnapshot = useCallback(
    (name: string): WorkspaceUserCanvasTemplate => {
      const trimmedName = name.trim();
      const templateName = trimmedName || formatCopyValue(studioNotices.defaultCanvasTemplateName, { index: userCanvasTemplates.length + 1 });
      const timestamp = new Date().toISOString();
      return {
        id: createLocalCanvasTemplateId(),
        name: templateName,
        description: describeCanvasTemplate(nodes, edges),
        nodes: cloneWorkspaceJson(nodes),
        edges: cloneWorkspaceJson(edges),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    },
    [edges, nodes, studioNotices.defaultCanvasTemplateName, userCanvasTemplates.length]
  );

  const handleSaveCanvasTemplate = useCallback(
    (name: string) => {
      const template = saveCanvasSnapshot(name);
      updateUserCanvasTemplates((templates) => [template, ...templates].slice(0, 24));
      setActiveUserCanvasTemplateId(template.id);
      setActiveEditorSurface('canvas');
      setNotice(formatCopyValue(studioNotices.canvasTemplateSavedAs, { name: template.name }));
    },
    [saveCanvasSnapshot, setActiveEditorSurface, setActiveUserCanvasTemplateId, setNotice, studioNotices.canvasTemplateSavedAs, updateUserCanvasTemplates]
  );

  const handleSaveActiveCanvasTemplate = useCallback(
    () => {
      if (!activeUserCanvasTemplateId) {
        const template = saveCanvasSnapshot('');
        updateUserCanvasTemplates((templates) => [template, ...templates].slice(0, 24));
        setActiveUserCanvasTemplateId(template.id);
        setActiveEditorSurface('canvas');
        setNotice(formatCopyValue(studioNotices.canvasTemplateSavedAs, { name: template.name }));
        return;
      }
      const activeTemplate = userCanvasTemplates.find((template) => template.id === activeUserCanvasTemplateId);
      if (!activeTemplate) {
        setActiveUserCanvasTemplateId(null);
        setNotice(studioNotices.canvasTemplateNotFound);
        return;
      }
      const timestamp = new Date().toISOString();
      updateUserCanvasTemplates((templates) => templates.map((template) => {
        if (template.id !== activeUserCanvasTemplateId) return template;
        return {
          ...template,
          description: describeCanvasTemplate(nodes, edges),
          nodes: cloneWorkspaceJson(nodes),
          edges: cloneWorkspaceJson(edges),
          updatedAt: timestamp,
        };
      }));
      setNotice(formatCopyValue(studioNotices.canvasTemplateSaved, { name: activeTemplate.name }));
    },
    [activeUserCanvasTemplateId, edges, nodes, saveCanvasSnapshot, setActiveEditorSurface, setActiveUserCanvasTemplateId, setNotice, studioNotices.canvasTemplateNotFound, studioNotices.canvasTemplateSaved, studioNotices.canvasTemplateSavedAs, updateUserCanvasTemplates, userCanvasTemplates]
  );

  const handleApplyUserCanvasTemplate = useCallback(
    (templateId: string) => {
      const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
      if (!template) {
        setNotice(studioNotices.canvasTemplateNotFound);
        return;
      }
      const nextNodes = cloneWorkspaceJson(template.nodes);
      const nextEdges = cloneWorkspaceJson(template.edges);
      commitCanvasGraph(() => ({
        edges: nextEdges,
        nodes: nextNodes,
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(null);
      setActiveUserCanvasTemplateId(template.id);
      setCanvasRevision((value) => value + 1);
      setNotice(formatCopyValue(studioNotices.canvasTemplateApplied, { name: template.name }));
    },
    [commitCanvasGraph, setActiveEditorSurface, setActiveUserCanvasTemplateId, setCanvasRevision, setNotice, setSelectedNodeId, studioNotices.canvasTemplateApplied, studioNotices.canvasTemplateNotFound, userCanvasTemplates]
  );

  const handleCreateCanvasFromTemplate = useCallback(
    (templateId: WorkspaceTemplateId) => {
      const starterTemplate = createStarterWorkspaceTemplate(templateId);
      const starterName = starterTemplateNoticeName(starterTemplate.id, starterTemplate.name, studioCanvasCopy.templateSummaries);
      const timestamp = new Date().toISOString();
      const template: WorkspaceUserCanvasTemplate = {
        id: createLocalCanvasTemplateId(),
        name: starterName,
        description: describeCanvasTemplate(starterTemplate.nodes, starterTemplate.edges),
        nodes: cloneWorkspaceJson(starterTemplate.nodes),
        edges: cloneWorkspaceJson(starterTemplate.edges),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      commitCanvasGraph(() => ({
        edges: cloneWorkspaceJson(starterTemplate.edges),
        nodes: cloneWorkspaceJson(starterTemplate.nodes),
      }));
      updateUserCanvasTemplates((templates) => [template, ...templates].slice(0, 24));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(null);
      setActiveTemplateId(starterTemplate.id);
      setActiveUserCanvasTemplateId(template.id);
      setCanvasRevision((value) => value + 1);
      setNotice(formatCopyValue(studioNotices.canvasTemplateCreatedFrom, { name: template.name }));
    },
    [commitCanvasGraph, setActiveEditorSurface, setActiveTemplateId, setActiveUserCanvasTemplateId, setCanvasRevision, setNotice, setSelectedNodeId, studioCanvasCopy.templateSummaries, studioNotices.canvasTemplateCreatedFrom, updateUserCanvasTemplates]
  );

  const handleAddCanvasTemplate = useCallback(
    (templateId: WorkspaceTemplateId) => {
      const starterTemplate = createStarterWorkspaceTemplate(templateId);
      const starterName = starterTemplateNoticeName(starterTemplate.id, starterTemplate.name, studioCanvasCopy.templateSummaries);
      const remappedTemplate = remapStarterTemplateGraph(starterTemplate.id, starterTemplate);
      const templateNodes = offsetTemplateNodes({
        currentNodes: nodes,
        templateNodes: remappedTemplate.nodes,
      });
      commitCanvasGraph((current) => ({
        edges: [...current.edges, ...remappedTemplate.edges],
        nodes: [...current.nodes, ...templateNodes],
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(null);
      setActiveUserCanvasTemplateId(null);
      setCanvasRevision((value) => value + 1);
      setNotice(formatCopyValue(studioNotices.canvasTemplateAdded, { name: starterName }));
    },
    [commitCanvasGraph, nodes, setActiveEditorSurface, setActiveUserCanvasTemplateId, setCanvasRevision, setNotice, setSelectedNodeId, studioCanvasCopy.templateSummaries, studioNotices.canvasTemplateAdded]
  );

  const handleDuplicateUserCanvasTemplate = useCallback(
    (templateId: string) => {
      const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
      if (!template) return;
      const duplicate: WorkspaceUserCanvasTemplate = {
        ...template,
        id: createLocalCanvasTemplateId(),
        name: formatCopyValue(studioNotices.canvasTemplateDuplicateName, { name: template.name }),
        nodes: cloneWorkspaceJson(template.nodes),
        edges: cloneWorkspaceJson(template.edges),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateUserCanvasTemplates((templates) => [duplicate, ...templates].slice(0, 24));
      setNotice(formatCopyValue(studioNotices.canvasTemplateSaved, { name: duplicate.name }));
    },
    [setNotice, studioNotices.canvasTemplateDuplicateName, studioNotices.canvasTemplateSaved, updateUserCanvasTemplates, userCanvasTemplates]
  );

  const handleRenameUserCanvasTemplate = useCallback(
    (templateId: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
      if (!template) {
        setNotice(studioNotices.canvasTemplateNotFound);
        return;
      }
      updateUserCanvasTemplates((templates) => templates.map((template) => {
        if (template.id !== templateId) return template;
        return {
          ...template,
          name: trimmedName,
          updatedAt: new Date().toISOString(),
        };
      }));
      setNotice(formatCopyValue(studioNotices.canvasTemplateRenamed, { name: trimmedName }));
    },
    [setNotice, studioNotices.canvasTemplateNotFound, studioNotices.canvasTemplateRenamed, updateUserCanvasTemplates, userCanvasTemplates]
  );

  const handleDeleteUserCanvasTemplate = useCallback(
    (templateId: string) => {
      const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
      if (!template) return;
      if (
        typeof window !== 'undefined' &&
        !window.confirm(studioNotices.deleteCanvasTemplateConfirm.replace('{name}', template.name))
      ) return;
      updateUserCanvasTemplates((templates) => templates.filter((candidate) => candidate.id !== templateId));
      if (activeUserCanvasTemplateId === templateId) {
        setActiveUserCanvasTemplateId(null);
      }
      setNotice(formatCopyValue(studioNotices.canvasTemplateDeleted, { name: template.name }));
    },
    [activeUserCanvasTemplateId, setActiveUserCanvasTemplateId, setNotice, studioNotices.canvasTemplateDeleted, studioNotices.deleteCanvasTemplateConfirm, updateUserCanvasTemplates, userCanvasTemplates]
  );

  return {
    handleAddCanvasTemplate,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCreateCanvasFromTemplate,
    handleDeleteUserCanvasTemplate,
    handleDuplicateUserCanvasTemplate,
    handleRenameUserCanvasTemplate,
    handleSaveActiveCanvasTemplate,
    handleSaveCanvasTemplate,
  };
}
