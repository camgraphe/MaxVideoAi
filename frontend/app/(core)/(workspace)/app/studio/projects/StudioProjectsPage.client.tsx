'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  Clock3,
  Film,
  FolderOpen,
  Grid2X2,
  MoreVertical,
  Plus,
  Sparkles,
} from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../workspace/_lib/workspace-project-settings';
import { WORKSPACE_TEMPLATE_SUMMARIES } from '../workspace/_lib/workspace-templates';
import type { WorkspaceProjectSettings, WorkspaceTemplateId } from '../workspace/_lib/workspace-types';
import styles from './studio-projects.module.css';

const STUDIO_PROJECTS_STORAGE_KEY = 'maxvideoai.editor.projects.v1';

type StudioProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceProjectSettings;
  canvasTemplateId: WorkspaceTemplateId;
};

function createStudioProjectId(): string {
  if (globalThis.crypto?.randomUUID) return `project_${globalThis.crypto.randomUUID()}`;
  return `project_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readStudioProjects(): StudioProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_PROJECTS_STORAGE_KEY) ?? '[]') as StudioProjectRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((project) => (
      typeof project?.id === 'string' &&
      typeof project.name === 'string' &&
      project.settings &&
      typeof project.canvasTemplateId === 'string'
    ));
  } catch {
    return [];
  }
}

function writeStudioProjects(projects: StudioProjectRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STUDIO_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function normalizeStudioProjectTemplateId(value: unknown): WorkspaceTemplateId {
  if (typeof value === 'string' && WORKSPACE_TEMPLATE_SUMMARIES.some((template) => template.id === value)) {
    return value as WorkspaceTemplateId;
  }
  return 'product-ad';
}

function normalizeStudioProjectRecord(value: unknown): StudioProjectRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StudioProjectRecord>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id: record.id,
    name: record.name.trim() || 'Untitled edit',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    settings: coerceWorkspaceProjectSettings(record.settings),
    canvasTemplateId: normalizeStudioProjectTemplateId(record.canvasTemplateId),
  };
}

async function readStudioProjectsFromApi(): Promise<StudioProjectRecord[] | null> {
  try {
    const response = await authFetch('/api/studio/projects', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.projects)) return null;
    return payload.projects
      .map(normalizeStudioProjectRecord)
      .filter((project: StudioProjectRecord | null): project is StudioProjectRecord => Boolean(project));
  } catch {
    return null;
  }
}

async function saveStudioProjectToApi(project: StudioProjectRecord): Promise<StudioProjectRecord | null> {
  try {
    const response = await authFetch('/api/studio/projects', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) return null;
    return normalizeStudioProjectRecord(payload.project);
  } catch {
    return null;
  }
}

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Local draft';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function studioProjectTemplateName(templateId: WorkspaceTemplateId): string {
  return WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === templateId)?.name ?? 'Custom canvas';
}

function studioProjectTemplateThumbnail(templateId: WorkspaceTemplateId): string {
  return WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === templateId)?.thumbnailUrl ?? '/assets/marketing/app-dashboard.webp';
}

export default function StudioProjectsPageClient() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [projects, setProjects] = useState<StudioProjectRecord[]>([]);
  const [name, setName] = useState('');
  const [canvasTemplateId, setCanvasTemplateId] = useState<WorkspaceTemplateId>('product-ad');
  const visibleTemplates = useMemo(() => WORKSPACE_TEMPLATE_SUMMARIES.slice(0, 6), []);
  const selectedTemplate = useMemo(
    () => WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === canvasTemplateId) ?? WORKSPACE_TEMPLATE_SUMMARIES[0],
    [canvasTemplateId]
  );

  useEffect(() => {
    setIsHydrated(true);
    const localProjects = readStudioProjects();
    setProjects(localProjects);

    let cancelled = false;
    void readStudioProjectsFromApi().then((serverProjects) => {
      if (cancelled || !serverProjects) return;
      setProjects(serverProjects);
      writeStudioProjects(serverProjects);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const createProject = async () => {
    const now = new Date().toISOString();
    const project: StudioProjectRecord = {
      id: createStudioProjectId(),
      name: name.trim() || 'Untitled edit',
      createdAt: now,
      updatedAt: now,
      settings: { ...DEFAULT_WORKSPACE_PROJECT_SETTINGS },
      canvasTemplateId,
    };
    const nextProjects = [project, ...projects].slice(0, 20);
    setProjects(nextProjects);
    writeStudioProjects(nextProjects);
    const savedProject = await saveStudioProjectToApi(project);
    if (savedProject) {
      const serverProjects = [savedProject, ...nextProjects.filter((candidate) => candidate.id !== savedProject.id)].slice(0, 20);
      setProjects(serverProjects);
      writeStudioProjects(serverProjects);
    }
    router.push(`/app/studio/workspace/${savedProject?.id ?? project.id}`);
  };

  return (
    <div className={styles.projectsShell}>
      <section className={styles.projectsHero} aria-labelledby="studio-projects-title">
        <div className={styles.brandPill}>
          <Film size={16} />
          MaxVideoAI Studio
        </div>
        <div>
          <h1 id="studio-projects-title">Studio projects</h1>
          <p>Create a project, choose the starting canvas, then configure each sequence inside the editor.</p>
        </div>
      </section>

      <section className={styles.projectsGrid}>
        <section className={styles.newProjectPanel} aria-label="New project form">
          <div className={styles.panelTitleRow}>
            <span className={styles.titleIcon}>
              <Plus size={24} />
            </span>
            <div>
              <h2>Create a new project</h2>
              <span>Set up your project in a few steps</span>
            </div>
          </div>

          <label className={styles.projectField}>
            <span className={styles.fieldLabelRow}>
              Project name
              <small>{name.length} / 60</small>
            </span>
            <input
              value={name}
              maxLength={60}
              placeholder="Give your project a name..."
              onChange={(event) => setName(event.target.value)}
              disabled={!isHydrated}
            />
          </label>

          <fieldset className={styles.templatePicker} aria-label="Canvas template">
            <legend>Canvas template</legend>
            <div className={styles.templateGrid}>
              {visibleTemplates.map((template) => {
                const selected = template.id === selectedTemplate?.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={styles.templateCard}
                    aria-pressed={selected}
                    onClick={() => setCanvasTemplateId(template.id)}
                    disabled={!isHydrated}
                  >
                    <span className={styles.templateThumb}>
                      <img src={template.thumbnailUrl} alt="" />
                    </span>
                    {selected ? (
                      <span className={styles.templateSelectedBadge} aria-hidden>
                        <Check size={14} />
                      </span>
                    ) : null}
                    <span className={styles.templateTitleRow}>
                      <strong>{template.name}</strong>
                      <em>Pro</em>
                    </span>
                    <span>{template.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button type="button" className={styles.secondaryAction} disabled={!isHydrated}>
            <Grid2X2 size={17} />
            Browse all templates
            <ChevronRight size={16} />
          </button>

          <button type="button" className={styles.primaryAction} onClick={createProject} disabled={!isHydrated}>
            <Sparkles size={16} />
            Create project
          </button>
        </section>

        <section className={styles.recentProjectsPanel} aria-label="Recent projects">
          <div className={styles.panelTitleRow}>
            <FolderOpen size={17} />
            <div>
              <h2>Recent projects</h2>
              <span>Pick up where you left off</span>
            </div>
          </div>

          <div className={styles.projectList}>
            {projects.length ? (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={styles.projectCard}
                  onClick={() => router.push(`/app/studio/workspace/${project.id}`)}
                >
                  <img src={studioProjectTemplateThumbnail(project.canvasTemplateId)} alt="" />
                  <span className={styles.projectCardCopy}>
                    <strong>{project.name}</strong>
                    <span>Updated {formatProjectDate(project.updatedAt)}</span>
                    <small>
                      <Film size={12} />
                      {project.settings.aspectRatio}
                      <Clock3 size={12} />
                      {studioProjectTemplateName(project.canvasTemplateId)}
                    </small>
                  </span>
                  <MoreVertical size={18} aria-hidden />
                </button>
              ))
            ) : (
              <div className={styles.emptyProjects}>
                <strong>No local projects yet.</strong>
                <span>Create the first one to open a dedicated workspace URL.</span>
              </div>
            )}
          </div>
          {projects.length ? (
            <button type="button" className={styles.viewAllProjects}>
              View all projects
              <ChevronRight size={16} />
            </button>
          ) : null}
        </section>
      </section>
    </div>
  );
}
