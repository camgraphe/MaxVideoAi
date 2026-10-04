import { copyFile, mkdir, lstat, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import type { Asset, LibraryAsset, Project } from "../shared/types";
import { StudioError } from "../shared/timeline";
import { mediaDir } from "./media";
import { ProjectStore } from "./store";

// This local library contains only this runtime's projects. Production must
// supply an authenticated, account-scoped adapter before exposing these actions.
export class MediaLibraryService {
  constructor(
    private store: ProjectStore,
    private root: string,
  ) {}

  async list(): Promise<LibraryAsset[]> {
    const projects = await this.store.list();
    const available = new Set(
      projects.flatMap((p) => p.assets.map((a) => `${p.id}:${a.id}`)),
    );
    return projects.flatMap((p) =>
      p.assets
        .toReversed()
        .filter(
          (a) =>
            !a.librarySource ||
            !available.has(
              `${a.librarySource.projectId}:${a.librarySource.assetId}`,
            ),
        )
        .map((asset) => ({ asset, projectId: p.id, projectTitle: p.title })),
    );
  }

  async use(
    projectId: string,
    sourceProjectId: string,
    assetId: string,
  ): Promise<{ project: Project; asset: Asset }> {
    if (typeof assetId !== "string" || !/^[a-f0-9-]{36}$/.test(assetId))
      throw new StudioError("Média invalide.");
    const source = await this.store.get(sourceProjectId);
    const asset = source.assets.find((a) => a.id === assetId);
    if (!asset) throw new StudioError("Média introuvable.", 404);
    if (projectId === sourceProjectId) return { project: source, asset };
    const provenance = asset.librarySource ?? {
      projectId: sourceProjectId,
      assetId,
    };
    const created: string[] = [];
    let selected: Asset | undefined;
    try {
      const project = await this.store.update(projectId, async (p) => {
        selected = p.assets.find(
          (a) =>
            (p.id === provenance.projectId && a.id === provenance.assetId) ||
            (a.librarySource?.projectId === provenance.projectId &&
              a.librarySource.assetId === provenance.assetId),
        );
        if (selected) return p;
        const id = crypto.randomUUID(),
          dir = mediaDir(this.root, p.id);
        await mkdir(dir, { recursive: true });
        const copies = new Map<string, string>();
        for (const file of new Set([
          asset.file,
          asset.original,
          asset.poster,
        ])) {
          if (file === undefined) continue;
          if (!/^[a-f0-9-]{36}\.(jpg|mp4|mp3|original)$/.test(file))
            throw new StudioError("Chemin de média invalide.");
          const input = join(mediaDir(this.root, source.id), file);
          if (!(await lstat(input)).isFile())
            throw new StudioError("Source de média invalide.");
          const extension = file.slice(file.lastIndexOf("."));
          const name =
            (Array.from(copies.values()).includes(id + extension)
              ? crypto.randomUUID()
              : id) + extension;
          const output = join(dir, name);
          await copyFile(input, output, constants.COPYFILE_EXCL);
          created.push(output);
          copies.set(file, name);
        }
        selected = {
          ...structuredClone(asset),
          id,
          file: copies.get(asset.file)!,
          original: asset.original ? copies.get(asset.original) : undefined,
          poster: asset.poster ? copies.get(asset.poster) : undefined,
          librarySource: provenance,
        };
        p.assets.push(selected);
        return p;
      });
      return { project, asset: selected! };
    } catch (error) {
      await Promise.all(created.map((file) => rm(file, { force: true })));
      throw error;
    }
  }
}
