'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, FolderOpen, Plus, Settings2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { coerceWorkspaceProjectSettings } from '../workspace/_lib/workspace-project-settings';
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

const DEFAULT_PROJECT_SETTINGS: WorkspaceProjectSettings = {
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 30,
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

export default function StudioProjectsPageClient() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [projects, setProjects] = useState<StudioProjectRecord[]>([]);
  const [name, setName] = useState('Untitled edit');
  const [aspectRatio, setAspectRatio] = useState<WorkspaceProjectSettings['aspectRatio']>(DEFAULT_PROJECT_SETTINGS.aspectRatio);
  const [resolution, setResolution] = useState<WorkspaceProjectSettings['resolution']>(DEFAULT_PROJECT_SETTINGS.resolution);
  const [fps, setFps] = useState<WorkspaceProjectSettings['fps']>(DEFAULT_PROJECT_SETTINGS.fps);
  const [canvasTemplateId, setCanvasTemplateId] = useState<WorkspaceTemplateId>('product-ad');
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
      settings: {
        aspectRatio,
        resolution,
        fps,
      },
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
    <main className={styles.projectsShell}>
      <section className={styles.projectsHero} aria-labelledby="studio-projects-title">
        <div className={styles.brandPill}>
          <Film size={16} />
          MaxVideoAI Studio
        </div>
        <div>
          <h1 id="studio-projects-title">Studio projects</h1>
          <p>Create an edit project, choose its sequence settings, then build the generation canvas and timeline.</p>
        </div>
      </section>

      <section className={styles.projectsGrid}>
        <section className={styles.newProjectPanel} aria-label="New project form">
          <div className={styles.panelTitleRow}>
            <Settings2 size={17} />
            <div>
              <h2>New project</h2>
              <span>Sequence settings and starting canvas</span>
            </div>
          </div>

          <label className={styles.projectField}>
            Project name
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={!isHydrated} />
          </label>

          <div className={styles.projectFieldGrid}>
            <label className={styles.projectField}>
              Ratio
              <select
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value as WorkspaceProjectSettings['aspectRatio'])}
                disabled={!isHydrated}
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="21:9">21:9</option>
              </select>
            </label>

            <label className={styles.projectField}>
              Resolution
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value as WorkspaceProjectSettings['resolution'])}
                disabled={!isHydrated}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="1440p">1440p</option>
                <option value="4k">4K</option>
              </select>
            </label>

            <label className={styles.projectField}>
              FPS
              <select
                value={fps}
                onChange={(event) => setFps(Number(event.target.value) as WorkspaceProjectSettings['fps'])}
                disabled={!isHydrated}
              >
                <option value={24}>24</option>
                <option value={25}>25</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </label>
          </div>

          <label className={styles.projectField}>
            Canvas template
            <select
              value={canvasTemplateId}
              onChange={(event) => setCanvasTemplateId(event.target.value as WorkspaceTemplateId)}
              disabled={!isHydrated}
            >
              {WORKSPACE_TEMPLATE_SUMMARIES.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>

          <div className={styles.templatePreview}>
            <strong>{selectedTemplate?.name}</strong>
            <span>{selectedTemplate?.description}</span>
          </div>

          <button type="button" className={styles.primaryAction} onClick={createProject} disabled={!isHydrated}>
            <Plus size={16} />
            New project
          </button>
        </section>

        <section className={styles.recentProjectsPanel} aria-label="Recent projects">
          <div className={styles.panelTitleRow}>
            <FolderOpen size={17} />
            <div>
              <h2>Recent projects</h2>
              <span>Synced projects with local drafts as fallback</span>
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
                  <strong>{project.name}</strong>
                  <span>{project.settings.aspectRatio} · {project.settings.resolution} · {project.settings.fps} fps</span>
                  <small>Updated {formatProjectDate(project.updatedAt)}</small>
                </button>
              ))
            ) : (
              <div className={styles.emptyProjects}>
                <strong>No local projects yet.</strong>
                <span>Create the first one to open a dedicated workspace URL.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
