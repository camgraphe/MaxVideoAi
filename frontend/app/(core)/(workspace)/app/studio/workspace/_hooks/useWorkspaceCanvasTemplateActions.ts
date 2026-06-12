import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { createStarterWorkspaceTemplate } from '../_lib/workspace-templates';
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
import { writeUserCanvasTemplates } from '../_state/workspace-persistence';
import {
  deleteUserCanvasTemplateFromApi,
  describeCanvasTemplate,
  saveUserCanvasTemplateToApi,
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
  studioNotices,
  userCanvasTemplates,
}: UseWorkspaceCanvasTemplateActionsParams): {
  handleApplyCanvasTemplate: (templateId: WorkspaceTemplateId) => void;
  handleApplyUserCanvasTemplate: (templateId: string) => void;
  handleDeleteUserCanvasTemplate: (templateId: string) => void;
  handleDuplicateUserCanvasTemplate: (templateId: string) => void;
  handleSaveCanvasTemplate: (name: string) => void;
} {
  const updateUserCanvasTemplates = useCallback(
    (updater: (templates: WorkspaceUserCanvasTemplate[]) => WorkspaceUserCanvasTemplate[]) => {
      setUserCanvasTemplates((currentTemplates) => {
        const nextTemplates = updater(currentTemplates);
        writeUserCanvasTemplates(nextTemplates);
        return nextTemplates;
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
      setNotice(formatCopyValue(studioNotices.canvasTemplateApplied, { name: template.name }));
    },
    [commitCanvasGraph, setActiveEditorSurface, setActiveTemplateId, setActiveUserCanvasTemplateId, setCanvasRevision, setNotice, setSelectedNodeId, studioNotices.canvasTemplateApplied]
  );

  const handleSaveCanvasTemplate = useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      const templateName = trimmedName || formatCopyValue(studioNotices.defaultCanvasTemplateName, { index: userCanvasTemplates.length + 1 });
      const createdAt = new Date().toISOString();
      const template: WorkspaceUserCanvasTemplate = {
        id: createLocalCanvasTemplateId(),
        name: templateName,
        description: describeCanvasTemplate(nodes, edges),
        nodes: cloneWorkspaceJson(nodes),
        edges: cloneWorkspaceJson(edges),
        createdAt,
      };
      updateUserCanvasTemplates((templates) => [template, ...templates].slice(0, 24));
      void saveUserCanvasTemplateToApi(template);
      setActiveUserCanvasTemplateId(template.id);
      setActiveEditorSurface('canvas');
      setNotice(formatCopyValue(studioNotices.canvasTemplateSavedAs, { name: template.name }));
    },
    [edges, nodes, setActiveEditorSurface, setActiveUserCanvasTemplateId, setNotice, studioNotices.canvasTemplateSavedAs, studioNotices.defaultCanvasTemplateName, updateUserCanvasTemplates, userCanvasTemplates.length]
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
      };
      updateUserCanvasTemplates((templates) => [duplicate, ...templates].slice(0, 24));
      void saveUserCanvasTemplateToApi(duplicate);
      setNotice(formatCopyValue(studioNotices.canvasTemplateSaved, { name: duplicate.name }));
    },
    [setNotice, studioNotices.canvasTemplateDuplicateName, studioNotices.canvasTemplateSaved, updateUserCanvasTemplates, userCanvasTemplates]
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
      void deleteUserCanvasTemplateFromApi(templateId);
      if (activeUserCanvasTemplateId === templateId) {
        setActiveUserCanvasTemplateId(null);
      }
      setNotice(formatCopyValue(studioNotices.canvasTemplateDeleted, { name: template.name }));
    },
    [activeUserCanvasTemplateId, setActiveUserCanvasTemplateId, setNotice, studioNotices.canvasTemplateDeleted, studioNotices.deleteCanvasTemplateConfirm, updateUserCanvasTemplates, userCanvasTemplates]
  );

  return {
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleDeleteUserCanvasTemplate,
    handleDuplicateUserCanvasTemplate,
    handleSaveCanvasTemplate,
  };
}
