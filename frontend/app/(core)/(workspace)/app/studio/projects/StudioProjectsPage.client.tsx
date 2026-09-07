'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Copy,
  Film,
  LayoutTemplate,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { authFetch, hasAuthFetchSessionHint } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
} from '../workspace/_lib/workspace-project-settings';
import {
  studioApiSyncStatusFromResponse,
  type StudioApiResult,
  type StudioApiSyncStatus,
} from '../workspace/_state/workspace-api-persistence';
import {
  MINIMAL_START_WORKSPACE_TEMPLATE_ID,
  WORKSPACE_TEMPLATE_SUMMARIES,
} from '../workspace/_lib/workspace-templates';
import type { WorkspaceTemplateId } from '../workspace/_lib/workspace-types';
import {
  formatStudioProjectDate,
  localizeStudioTemplateSummaries,
  resolveStudioCopy,
  type StudioCopy,
} from '../_lib/studio-copy';
import {
  normalizeStudioProjectRecord,
  normalizeStudioProjectRecords,
  type StudioProjectRecord,
} from './studio-project-records';
import { readStudioProjectCanvasPreview } from './studio-project-preview-storage';
import styles from './studio-projects.module.css';

const STUDIO_PROJECTS_STORAGE_KEY = 'maxvideoai.editor.projects.v1';
const DEFAULT_STUDIO_PROJECT_TEMPLATE_ID: WorkspaceTemplateId = MINIMAL_START_WORKSPACE_TEMPLATE_ID;
const STUDIO_PROJECT_STARTER_IDS = ['product-ad', 'storyboard-to-video', 'cinematic-scene'] as const;
const STUDIO_PROJECT_STARTER_TEMPLATE_IDS: Record<
  (typeof STUDIO_PROJECT_STARTER_IDS)[number],
  WorkspaceTemplateId
> = {
  'product-ad': 'guided-product-ad',
  'storyboard-to-video': 'guided-storyboard-to-video',
  'cinematic-scene': 'guided-cinematic-scene',
};
const STUDIO_PROJECT_STARTER_IMAGES: Record<(typeof STUDIO_PROJECT_STARTER_IDS)[number], string> = {
  'product-ad': '/assets/studio/starters/product-ad.webp',
  'storyboard-to-video': '/assets/studio/starters/storyboard-to-video.webp',
  'cinematic-scene': '/assets/studio/starters/cinematic-trailer.webp',
};
const STUDIO_PROJECT_STARTER_CANVAS_IMAGES: Record<(typeof STUDIO_PROJECT_STARTER_IDS)[number], string> = {
  'product-ad': '/assets/studio/starters/product-ad-canvas.webp',
  'storyboard-to-video': '/assets/studio/starters/storyboard-to-video-canvas.webp',
  'cinematic-scene': '/assets/studio/starters/cinematic-trailer-canvas.webp',
};

function createStudioProjectId(): string {
  if (globalThis.crypto?.randomUUID) return `project_${globalThis.crypto.randomUUID()}`;
  return `project_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readStudioProjects(studioCopy: StudioCopy): StudioProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_PROJECTS_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeStudioProjectRecords(parsed, {
      untitledProject: studioCopy.projects.untitledProject,
    });
  } catch {
    return [];
  }
}

function writeStudioProjects(projects: StudioProjectRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STUDIO_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function studioProjectsApiNotice(status: StudioApiSyncStatus, notices: StudioCopy['notices']): string | null {
  if (status === 'ready') return null;
  if (status === 'unauthorized') return notices.studioApiUnauthorized;
  if (status === 'unavailable') return notices.studioApiUnavailable;
  return notices.studioLocalFallbackActive;
}

async function readStudioProjectsFromApi(studioCopy: StudioCopy): Promise<StudioApiResult<StudioProjectRecord[]>> {
  if (!hasAuthFetchSessionHint()) return { data: null, status: 'unauthorized' };
  try {
    const response = await authFetch('/api/studio/projects', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok || !Array.isArray(payload.projects)) return { data: null, status: 'error' };
    return {
      data: payload.projects
        .map((project: unknown) => normalizeStudioProjectRecord(project, {
          untitledProject: studioCopy.projects.untitledProject,
        }))
        .filter((project: StudioProjectRecord | null): project is StudioProjectRecord => Boolean(project)),
      status: 'ready',
    };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function saveStudioProjectToApi(
  project: StudioProjectRecord,
  studioCopy: StudioCopy
): Promise<StudioApiResult<StudioProjectRecord>> {
  if (!hasAuthFetchSessionHint()) return { data: null, status: 'unauthorized' };
  try {
    const response = await authFetch('/api/studio/projects', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return { data: null, status: 'error' };
    return {
      data: normalizeStudioProjectRecord(payload.project, {
        untitledProject: studioCopy.projects.untitledProject,
      }),
      status: 'ready',
    };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function updateStudioProjectInApi(
  project: StudioProjectRecord,
  studioCopy: StudioCopy
): Promise<StudioApiResult<StudioProjectRecord>> {
  if (!hasAuthFetchSessionHint()) return { data: null, status: 'unauthorized' };
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(project.id)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return { data: null, status: 'error' };
    return {
      data: normalizeStudioProjectRecord(payload.project, {
        untitledProject: studioCopy.projects.untitledProject,
      }),
      status: 'ready',
    };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function deleteStudioProjectFromApi(projectId: string): Promise<StudioApiSyncStatus> {
  if (!hasAuthFetchSessionHint()) return 'unauthorized';
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return status;
    const payload = await response.json().catch(() => null);
    return payload?.ok ? 'ready' : 'error';
  } catch {
    return 'error';
  }
}

function starterCanvasImageForTemplate(templateId: WorkspaceTemplateId): string | null {
  const starterId = STUDIO_PROJECT_STARTER_IDS.find((candidate) => (
    candidate === templateId || STUDIO_PROJECT_STARTER_TEMPLATE_IDS[candidate] === templateId
  ));
  return starterId ? STUDIO_PROJECT_STARTER_CANVAS_IMAGES[starterId] : null;
}

export default function StudioProjectsPageClient({ initialStarterTemplateId = null }: {
  initialStarterTemplateId?: WorkspaceTemplateId | null;
}) {
  const router = useRouter();
  const { locale, dictionary } = useI18n();
  const studioCopy = useMemo(() => resolveStudioCopy(dictionary), [dictionary]);
  const appLocale = locale as AppLocale;
  const marketingStarterHandledRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProjectsLoaded, setIsProjectsLoaded] = useState(false);
  const [projects, setProjects] = useState<StudioProjectRecord[]>([]);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const starterTemplates = useMemo(() => {
    const starterIds = new Set<WorkspaceTemplateId>(STUDIO_PROJECT_STARTER_IDS);
    return localizeStudioTemplateSummaries(
      WORKSPACE_TEMPLATE_SUMMARIES.filter((template) => starterIds.has(template.id)),
      studioCopy
    );
  }, [studioCopy]);
  const renameProject = useMemo(
    () => projects.find((project) => project.id === renameProjectId) ?? null,
    [projects, renameProjectId]
  );
  const deleteProject = useMemo(
    () => projects.find((project) => project.id === deleteProjectId) ?? null,
    [deleteProjectId, projects]
  );
  const projectCanvasPreviews = useMemo(
    () => new Map(projects.map((project) => [
      project.id,
      readStudioProjectCanvasPreview(project.id) ?? starterCanvasImageForTemplate(project.canvasTemplateId),
    ])),
    [projects]
  );

  const persistProjects = (nextProjects: StudioProjectRecord[]) => {
    setProjects(nextProjects);
    writeStudioProjects(nextProjects);
  };

  useEffect(() => {
    setIsHydrated(true);
    const localProjects = readStudioProjects(studioCopy);
    setProjects(localProjects);

    let cancelled = false;
    void readStudioProjectsFromApi(studioCopy)
      .then((serverResult) => {
        if (cancelled) return;
        const nextNotice = studioProjectsApiNotice(serverResult.status, studioCopy.notices);
        setApiNotice(nextNotice);
        if (!serverResult.data) return;
        setProjects(serverResult.data);
        writeStudioProjects(serverResult.data);
      })
      .finally(() => {
        if (!cancelled) setIsProjectsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [studioCopy]);

  const createProjectFromTemplate = useCallback(async (
    templateId: WorkspaceTemplateId = DEFAULT_STUDIO_PROJECT_TEMPLATE_ID
  ) => {
    const now = new Date().toISOString();
    const project: StudioProjectRecord = {
      id: createStudioProjectId(),
      name: studioCopy.projects.untitledProject,
      createdAt: now,
      updatedAt: now,
      settings: { ...DEFAULT_WORKSPACE_PROJECT_SETTINGS },
      canvasTemplateId: templateId,
    };
    const nextProjects = [project, ...projects].slice(0, 20);
    setProjects(nextProjects);
    writeStudioProjects(nextProjects);
    const savedProjectResult = await saveStudioProjectToApi(project, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProjectResult.status, studioCopy.notices));
    const savedProject = savedProjectResult.data;
    if (savedProject) {
      const syncedProject = savedProject;
      const serverProjects = [syncedProject, ...nextProjects.filter((candidate) => candidate.id !== syncedProject.id)].slice(0, 20);
      setProjects(serverProjects);
      writeStudioProjects(serverProjects);
    }
    router.push(`/app/studio/workspace/${savedProject?.id ?? project.id}`);
  }, [projects, router, studioCopy]);

  const createProject = async (templateId: WorkspaceTemplateId = DEFAULT_STUDIO_PROJECT_TEMPLATE_ID) => (
    createProjectFromTemplate(templateId)
  );

  useEffect(() => {
    if (!isProjectsLoaded || !initialStarterTemplateId || marketingStarterHandledRef.current) return;
    marketingStarterHandledRef.current = true;
    window.history.replaceState(window.history.state, '', '/app/studio/projects');
    void createProjectFromTemplate(initialStarterTemplateId);
  }, [createProjectFromTemplate, initialStarterTemplateId, isProjectsLoaded]);

  const openRenameDialog = (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    setRenameProjectId(project.id);
    setRenameProjectName(project.name);
  };

  const renameSelectedProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameProject) return;
    const trimmedName = renameProjectName.trim();
    if (!trimmedName) return;
    const updatedProject = {
      ...renameProject,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };
    const nextProjects = projects.map((project) => (project.id === updatedProject.id ? updatedProject : project));
    persistProjects(nextProjects);
    setRenameProjectId(null);
    const savedProject = await updateStudioProjectInApi(updatedProject, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProject.status, studioCopy.notices));
    if (savedProject.data) {
      const syncedProject = savedProject.data;
      persistProjects(nextProjects.map((project) => (project.id === syncedProject.id ? syncedProject : project)));
    }
  };

  const duplicateProject = async (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    const now = new Date().toISOString();
    const duplicate: StudioProjectRecord = {
      ...project,
      id: createStudioProjectId(),
      name: `${project.name} ${studioCopy.projects.duplicateSuffix}`,
      createdAt: now,
      updatedAt: now,
    };
    const nextProjects = [duplicate, ...projects].slice(0, 20);
    persistProjects(nextProjects);
    const savedProject = await saveStudioProjectToApi(duplicate, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProject.status, studioCopy.notices));
    if (savedProject.data) {
      const syncedProjects = [savedProject.data, ...nextProjects.filter((candidate) => candidate.id !== duplicate.id)].slice(0, 20);
      persistProjects(syncedProjects);
    }
  };

  const requestDeleteProject = (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    setDeleteProjectId(project.id);
  };

  const confirmDeleteProject = async () => {
    if (!deleteProject) return;
    const projectId = deleteProject.id;
    const nextProjects = projects.filter((project) => project.id !== projectId);
    persistProjects(nextProjects);
    setDeleteProjectId(null);
    const status = await deleteStudioProjectFromApi(projectId);
    setApiNotice(studioProjectsApiNotice(status, studioCopy.notices));
  };

  return (
    <div className={styles.projectsShell}>
      <section id="studio-starter-chooser" className={styles.starterSection} aria-labelledby="studio-starter-title">
        {apiNotice ? (
          <div className={styles.syncNotice} role="status" aria-live="polite">
            {apiNotice}
          </div>
        ) : null}
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon} aria-hidden="true"><LayoutTemplate size={18} /></span>
          <div>
            <h1 id="studio-starter-title">{studioCopy.projects.starterTitle}</h1>
            <p>{studioCopy.projects.starterSubtitle}</p>
          </div>
        </div>

        <div className={styles.starterGrid}>
          {starterTemplates.map((template) => {
            const starterId = template.id as (typeof STUDIO_PROJECT_STARTER_IDS)[number];
            const starterName = starterId === 'product-ad'
              ? studioCopy.projects.starterNames.productAd
              : starterId === 'storyboard-to-video'
                ? studioCopy.projects.starterNames.storyboardToVideo
                : studioCopy.projects.starterNames.cinematicTrailer;
            const startLabel = studioCopy.projects.startTemplateAria.replace('{name}', starterName);
            return (
              <button
                key={template.id}
                type="button"
                className={styles.starterCard}
                aria-label={startLabel}
                onClick={() => void createProject(STUDIO_PROJECT_STARTER_TEMPLATE_IDS[starterId])}
                disabled={!isHydrated}
              >
                <span className={styles.starterImage}>
                  <span className={styles.starterCanvasPreview}>
                    <small>{studioCopy.projects.canvasPreviewLabel}</small>
                    <img src={STUDIO_PROJECT_STARTER_CANVAS_IMAGES[starterId]} alt="" />
                  </span>
                  <span className={styles.starterResultPreview}>
                    <small>{studioCopy.projects.resultPreviewLabel}</small>
                    <img src={STUDIO_PROJECT_STARTER_IMAGES[starterId]} alt="" />
                  </span>
                </span>
                <span className={styles.starterBody}>
                  <span className={styles.starterTitleRow}>
                    <strong>{starterName}</strong>
                    <ArrowRight size={17} aria-hidden="true" />
                  </span>
                  <span>{template.description}</span>
                  {template.flow ? <small>{template.flow}</small> : null}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.blankProjectAction}
          onClick={() => void createProject()}
          disabled={!isHydrated}
        >
          <span className={styles.blankProjectIcon} aria-hidden="true"><Plus size={18} /></span>
          <span>
            <strong>{studioCopy.projects.blankProject}</strong>
            <small>{studioCopy.projects.blankProjectDescription}</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <p className={styles.starterDisclaimer}>{studioCopy.projects.starterDisclaimer}</p>
      </section>

      {projects.length ? (
        <section className={styles.projectSection} aria-labelledby="studio-project-list-title">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon} aria-hidden="true"><Film size={18} /></span>
            <div>
              <h2 id="studio-project-list-title">{studioCopy.projects.allProjects}</h2>
              <p>{studioCopy.projects.recentSubtitle}</p>
            </div>
          </div>
          <div className={styles.projectGrid} id="studio-project-list">
            {projects.map((project) => {
              const projectActionsLabel = studioCopy.projects.projectActionsAria.replace('{name}', project.name);
              const previewUrl = projectCanvasPreviews.get(project.id);
              return (
                <div key={project.id} className={styles.projectCard}>
                  <button
                    type="button"
                    className={styles.projectCardMain}
                    onClick={() => router.push(`/app/studio/workspace/${project.id}`)}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="" />
                    ) : (
                      <span className={styles.projectCardPlaceholder} aria-hidden="true"><Film size={22} /></span>
                    )}
                    <span className={styles.projectCardCopy}>
                      <strong>{project.name}</strong>
                      <span>{formatStudioProjectDate(appLocale, project.updatedAt, studioCopy)}</span>
                    </span>
                  </button>
                  <span className={styles.projectActions}>
                    <button
                      type="button"
                      className={styles.projectActionButton}
                      aria-label={projectActionsLabel}
                      aria-haspopup="menu"
                      aria-expanded={openProjectMenuId === project.id}
                      onClick={() => setOpenProjectMenuId((current) => (current === project.id ? null : project.id))}
                    >
                      <MoreVertical size={18} aria-hidden />
                    </button>
                    {openProjectMenuId === project.id ? (
                      <span className={styles.projectActionMenu} role="menu" aria-label={projectActionsLabel}>
                        <button type="button" role="menuitem" onClick={() => openRenameDialog(project)}>
                          <Pencil size={14} />
                          {studioCopy.projects.rename}
                        </button>
                        <button type="button" role="menuitem" onClick={() => void duplicateProject(project)}>
                          <Copy size={14} />
                          {studioCopy.projects.duplicate}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.projectActionDanger}
                          onClick={() => requestDeleteProject(project)}
                        >
                          <Trash2 size={14} />
                          {studioCopy.projects.delete}
                        </button>
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {renameProject ? (
        <div className={styles.dialogBackdrop}>
          <form className={styles.projectDialog} role="dialog" aria-modal="true" aria-labelledby="rename-project-title" onSubmit={renameSelectedProject}>
            <div className={styles.dialogTitleRow}>
              <div>
                <h2 id="rename-project-title">{studioCopy.projects.renameTitle}</h2>
                <p>{studioCopy.projects.projectNameLabel}</p>
              </div>
              <button type="button" aria-label={studioCopy.projects.closeDialog} onClick={() => setRenameProjectId(null)}>
                <X size={17} />
              </button>
            </div>
            <label className={styles.projectField}>
              <span>{studioCopy.projects.projectNameLabel}</span>
              <input
                value={renameProjectName}
                maxLength={60}
                autoFocus
                onChange={(event) => setRenameProjectName(event.target.value)}
              />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogSecondaryButton} onClick={() => setRenameProjectId(null)}>
                {studioCopy.projects.cancel}
              </button>
              <button type="submit" className={styles.dialogPrimaryButton} disabled={!renameProjectName.trim()}>
                {studioCopy.projects.renameSubmit}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {deleteProject ? (
        <div className={styles.dialogBackdrop}>
          <div className={styles.projectDialog} role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className={styles.dialogTitleRow}>
              <div>
                <h2 id="delete-project-title">{studioCopy.projects.deleteTitle}</h2>
                <p>{studioCopy.projects.deleteBody}</p>
              </div>
              <button type="button" aria-label={studioCopy.projects.closeDialog} onClick={() => setDeleteProjectId(null)}>
                <X size={17} />
              </button>
            </div>
            <p className={styles.deleteWarning}>{deleteProject.name}</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogSecondaryButton} onClick={() => setDeleteProjectId(null)}>
                {studioCopy.projects.cancel}
              </button>
              <button type="button" className={styles.dialogDangerButton} onClick={() => void confirmDeleteProject()}>
                {studioCopy.projects.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
