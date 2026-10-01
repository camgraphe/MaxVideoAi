import { useCallback, useEffect, useRef, useState } from "react";
import type { Asset, Command, Project } from "../../shared/types";
import { isEdit } from "../../shared/timeline";
export const mediaUrl = (
  p: string,
  a: string,
  variant?: "poster" | "download" | "original",
) => `/api/projects/${p}/media/${a}${variant ? "?" + variant + "=1" : ""}`;
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options),
    data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Le serveur local ne répond pas.");
  return data;
}
export function useStudio() {
  const [project, setProject] = useState<Project>(),
    [projects, setProjects] = useState<{ id: string; title: string }[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const current = useRef<Project | undefined>(undefined),
    active = useRef(""),
    mounted = useRef(true);
  const accept = useCallback((p: Project) => {
    if (p.id === active.current) {
      current.current = p;
      setProject(p);
    }
  }, []);
  const list = useCallback(async () => {
    const all = await request<{ id: string; title: string }[]>("/api/projects");
    setProjects(all);
    return all;
  }, []);
  const open = useCallback(
    async (id: string) => {
      active.current = id;
      setLoading(true);
      try {
        const p = await request<Project>("/api/projects/" + id);
        accept(p);
        localStorage.setItem("studio-local-project", id);
      } catch (e) {
        setNotice((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [accept],
  );
  const create = useCallback(
    async (title = "Sans titre") => {
      const p = await request<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      active.current = p.id;
      accept(p);
      localStorage.setItem("studio-local-project", p.id);
      await list();
      return p;
    },
    [accept, list],
  );
  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    void (async () => {
      try {
        const all = await list();
        if (stopped) return;
        const saved = localStorage.getItem("studio-local-project"),
          id = all.find((p) => p.id === saved)?.id ?? all[0]?.id;
        if (id) await open(id);
        else await create();
      } catch (e) {
        setNotice((e as Error).message);
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
      mounted.current = false;
    };
  }, [list, open, create]);
  useEffect(() => {
    const timer = setInterval(() => {
      const id = active.current;
      if (id)
        void request<Project>("/api/projects/" + id)
          .then((p) => {
            if (current.current?.updatedAt !== p.updatedAt) accept(p);
          })
          .catch(() => {});
    }, 800);
    return () => clearInterval(timer);
  }, [accept]);
  const perform = useCallback(
    async <T>(work: (id: string, p: Project) => Promise<T>) => {
      const p = current.current;
      if (!p) return;
      setBusy(true);
      setNotice("");
      try {
        return await work(p.id, p);
      } catch (e) {
        setNotice((e as Error).message);
        const id = active.current;
        if (id)
          try {
            accept(await request<Project>("/api/projects/" + id));
          } catch {}
        return undefined;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [accept],
  );
  const command = useCallback(
    (command: Command, revision?: number) =>
      perform(async (id, p) => {
        const result = await request<{ project: Project }>(
          `/api/projects/${id}/commands`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
              expectedRevision: isEdit(command)
                ? (revision ?? p.revision)
                : undefined,
              command,
            }),
          },
        );
        accept(result.project);
        return result.project;
      }),
    [perform, accept],
  );
  const chat = useCallback(
    (text: string, context: { clipId?: string; assetIds?: string[] }) =>
      perform(async (id, p) => {
        const result = await request<{ project: Project }>(
          `/api/projects/${id}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              requestId: crypto.randomUUID(),
              context: { ...context, revision: p.revision },
            }),
          },
        );
        accept(result.project);
        return result.project;
      }),
    [perform, accept],
  );
  const upload = useCallback(
    (files: FileList | File[]) =>
      perform(async (id) => {
        for (const file of Array.from(files)) {
          if (file.size > 100 * 1024 * 1024)
            throw new Error("Une référence ne peut pas dépasser 100 Mo.");
          const p = await request<Project>(`/api/projects/${id}/import`, {
            method: "POST",
            headers: { "X-File-Name": encodeURIComponent(file.name) },
            body: file,
          });
          accept(p);
        }
      }),
    [perform, accept],
  );
  const useLibraryAsset = useCallback(
    (sourceProjectId: string, assetId: string) =>
      perform(async (id) => {
        const result = await request<{ project: Project; asset: Asset }>(
          `/api/projects/${id}/library`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceProjectId, assetId }),
          },
        );
        accept(result.project);
        return active.current === id ? result.asset : undefined;
      }),
    [perform, accept],
  );
  return {
    project,
    projects,
    busy,
    notice,
    setNotice,
    loading,
    open,
    create,
    list,
    command,
    chat,
    upload,
    useLibraryAsset,
  };
}
export type Studio = ReturnType<typeof useStudio>;
