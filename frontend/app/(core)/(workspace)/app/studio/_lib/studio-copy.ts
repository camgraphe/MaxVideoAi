import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { Dictionary } from '@/lib/i18n/types';

export type StudioCopy = {
  projects: {
    metaTitle: string;
    heroBadge: string;
    title: string;
    subtitle: string;
    createTitle: string;
    createSubtitle: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    canvasTemplateLabel: string;
    browseTemplates: string;
    createProject: string;
    creating: string;
    recentTitle: string;
    recentSubtitle: string;
    emptyRecent: string;
    viewAllProjects: string;
    projectActionsAria: string;
    rename: string;
    duplicate: string;
    duplicateSuffix: string;
    delete: string;
    renameTitle: string;
    renameSubmit: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    cancel: string;
    closeDialog: string;
    untitledProject: string;
    localDraft: string;
    customCanvas: string;
  };
  topbar: {
    productName: string;
    breadcrumbProjects: string;
    breadcrumbWorkspace: string;
    workspaceViewLabel: string;
    canvas: string;
    viewer: string;
    export: string;
    exportAria: string;
    mock: string;
    live: string;
    mockAria: string;
    switchToLight: string;
    switchToDark: string;
  };
  common: {
    secondsShort: string;
    itemSingular: string;
    itemPlural: string;
    folder: string;
    generatedClip: string;
  };
  notices: {
    canvasTemplateNotFound: string;
    projectMediaAssetNotFound: string;
    projectMediaFolderNotFound: string;
    generatedClipNotFound: string;
    unlockBeforeMoving: string;
    unlockBeforeCutting: string;
    unlockBeforeTrimming: string;
    unlockBeforeDeleting: string;
    selectedClipsUnlinked: string;
    selectedClipsLinked: string;
  };
};

export const DEFAULT_STUDIO_COPY: StudioCopy = {
  projects: {
    metaTitle: 'Studio Projects | MaxVideoAI',
    heroBadge: 'MaxVideoAI Studio',
    title: 'Studio projects',
    subtitle: 'Create a project, choose the starting canvas, then configure each sequence inside the editor.',
    createTitle: 'Create a new project',
    createSubtitle: 'Set up your project in a few steps',
    projectNameLabel: 'Project name',
    projectNamePlaceholder: 'Give your project a name...',
    canvasTemplateLabel: 'Canvas template',
    browseTemplates: 'Browse all templates',
    createProject: 'Create project',
    creating: 'Creating...',
    recentTitle: 'Recent projects',
    recentSubtitle: 'Pick up where you left off',
    emptyRecent: 'No Studio projects yet.',
    viewAllProjects: 'View all projects',
    projectActionsAria: 'Project actions for {name}',
    rename: 'Rename',
    duplicate: 'Duplicate',
    duplicateSuffix: 'copy',
    delete: 'Delete',
    renameTitle: 'Rename project',
    renameSubmit: 'Save name',
    deleteTitle: 'Delete project',
    deleteBody: 'This removes the project from Studio. This cannot be undone.',
    deleteConfirm: 'Delete project',
    cancel: 'Cancel',
    closeDialog: 'Close dialog',
    untitledProject: 'Untitled edit',
    localDraft: 'Local draft',
    customCanvas: 'Custom canvas',
  },
  topbar: {
    productName: 'MaxVideoAI Editor',
    breadcrumbProjects: 'Projects',
    breadcrumbWorkspace: 'Workspace',
    workspaceViewLabel: 'Workspace view',
    canvas: 'Canvas',
    viewer: 'Viewer',
    export: 'Export',
    exportAria: 'Open export dialog',
    mock: 'Mock',
    live: 'Live',
    mockAria: 'Toggle mock generation',
    switchToLight: 'Switch Studio to light mode',
    switchToDark: 'Switch Studio to dark mode',
  },
  common: {
    secondsShort: 's',
    itemSingular: 'item',
    itemPlural: 'items',
    folder: 'Folder',
    generatedClip: 'Generated clip',
  },
  notices: {
    canvasTemplateNotFound: 'Canvas template not found.',
    projectMediaAssetNotFound: 'Project media asset not found.',
    projectMediaFolderNotFound: 'Project media folder not found.',
    generatedClipNotFound: 'Generated clip not found.',
    unlockBeforeMoving: 'Unlock the track before moving clips.',
    unlockBeforeCutting: 'Unlock the track before cutting clips.',
    unlockBeforeTrimming: 'Unlock the track before trimming clips.',
    unlockBeforeDeleting: 'Unlock the track before deleting clips.',
    selectedClipsUnlinked: 'Selected timeline clips unlinked.',
    selectedClipsLinked: 'Selected timeline clips linked.',
  },
};

function readObject(source: Dictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function mergeCopy<T extends Record<string, unknown>>(fallback: T, value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, fallbackValue]) => {
      const sourceValue = source[key];
      if (
        fallbackValue &&
        typeof fallbackValue === 'object' &&
        !Array.isArray(fallbackValue) &&
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        return [key, mergeCopy(fallbackValue as Record<string, unknown>, sourceValue)];
      }
      return [key, typeof sourceValue === typeof fallbackValue ? sourceValue : fallbackValue];
    })
  ) as T;
}

export function resolveStudioCopy(dictionary: Dictionary | null | undefined): StudioCopy {
  if (!dictionary) return DEFAULT_STUDIO_COPY;
  return mergeCopy(
    DEFAULT_STUDIO_COPY as unknown as Record<string, unknown>,
    readObject(dictionary, 'workspace.studio')
  ) as unknown as StudioCopy;
}

export function formatStudioProjectDate(locale: AppLocale, value: string, copy: StudioCopy): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.projects.localDraft;

  return new Intl.DateTimeFormat(localeRegions[locale] ?? 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
