import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Asset, LibraryAsset, Project } from "../shared/types";
import { ProjectStore } from "../server/store";
import { MediaLibraryService } from "../server/library";
import { CommandService } from "../server/commands";
import { api } from "../server/http";
import { mediaDir } from "../server/media";

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "studio-library-"));
  const store = new ProjectStore(join(root, "projects"));
  const source = await store.create("Source"),
    target = await store.create("Target");
  const id = crypto.randomUUID();
  const asset: Asset = {
    id,
    name: "A reusable film",
    kind: "video",
    file: id + ".mp4",
    original: id + ".original",
    poster: id + ".jpg",
    duration: 4,
    width: 1280,
    height: 720,
    hasAudio: true,
    origin: "import",
  };
  const files = [asset.file, asset.original!, asset.poster!];
  await mkdir(mediaDir(root, source.id), { recursive: true });
  for (const file of files)
    await writeFile(join(mediaDir(root, source.id), file), "bytes:" + file);
  await store.update(source.id, (p) => ({ ...p, assets: [asset] }));
  return {
    root,
    store,
    source: await store.get(source.id),
    target,
    asset,
    files,
    library: new MediaLibraryService(store, root),
  };
}

test("the library spans projects, keeps reads immutable and deduplicates reused media", async () => {
  const f = await setup();
  try {
    const before = await f.store.list();
    const listed = await f.library.list();
    assert.deepEqual(listed, [
      { asset: f.asset, projectId: f.source.id, projectTitle: "Source" },
    ]);
    assert.deepEqual(await f.store.list(), before);
    const first = await f.library.use(f.target.id, f.source.id, f.asset.id);
    assert.equal(first.project.id, f.target.id);
    assert.notEqual(first.asset.id, f.asset.id);
    assert.deepEqual(first.asset.librarySource, {
      projectId: f.source.id,
      assetId: f.asset.id,
    });
    assert.deepEqual(await f.library.list(), listed);
    const same = await f.library.use(f.source.id, f.source.id, f.asset.id);
    assert.equal(same.asset.id, f.asset.id);
    assert.deepEqual(await f.store.get(f.source.id), f.source);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("concurrent reuse preserves originals, remains idempotent after restart and supports independent edits", async () => {
  const f = await setup();
  try {
    const [first, second] = await Promise.all([
      f.library.use(f.target.id, f.source.id, f.asset.id),
      f.library.use(f.target.id, f.source.id, f.asset.id),
    ]);
    assert.equal(first.asset.id, second.asset.id);
    assert.equal(second.project.assets.length, 1);
    assert.equal(second.project.revision, 0);
    assert.deepEqual(second.project.clips, []);
    assert.deepEqual(second.project.messages, []);
    for (const property of ["file", "original", "poster"] as const) {
      assert.deepEqual(
        await readFile(
          join(mediaDir(f.root, f.target.id), first.asset[property]!),
        ),
        await readFile(join(mediaDir(f.root, f.source.id), f.asset[property]!)),
      );
    }
    const restarted = new MediaLibraryService(
      new ProjectStore(f.store.root),
      f.root,
    );
    assert.equal(
      (await restarted.use(f.target.id, f.source.id, f.asset.id)).asset.id,
      first.asset.id,
    );
    const commands = new CommandService(f.store);
    const inserted = (
      await commands.execute(f.target.id, {
        requestId: "insert",
        expectedRevision: 0,
        command: { type: "insert", assetId: first.asset.id },
      })
    ).project;
    const edited = (
      await commands.execute(f.target.id, {
        requestId: "trim",
        expectedRevision: inserted.revision,
        command: {
          type: "trim",
          clipId: inserted.clips[0].id,
          inFrame: 24,
          outFrame: 72,
        },
      })
    ).project;
    assert.equal(edited.clips[0].inFrame, 24);
    assert.deepEqual(await f.store.get(f.source.id), f.source);
    assert.deepEqual((await f.store.get(f.target.id)).assets[0], first.asset);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("invalid, missing or linked library sources reject reuse and clean incomplete copies", async () => {
  const f = await setup();
  try {
    await assert.rejects(
      () => f.library.use(f.target.id, f.source.id, "bad"),
      /invalide/,
    );
    await assert.rejects(
      () => f.library.use(f.target.id, f.source.id, crypto.randomUUID()),
      /introuvable/,
    );
    await f.store.update(f.source.id, (p) => ({
      ...p,
      assets: [{ ...f.asset, original: "../escape" }],
    }));
    await assert.rejects(
      () => f.library.use(f.target.id, f.source.id, f.asset.id),
      /Chemin/,
    );
    assert.deepEqual(await f.store.get(f.target.id), f.target);
    assert.deepEqual(await readdir(mediaDir(f.root, f.target.id)), []);
    const original = join(mediaDir(f.root, f.source.id), f.asset.original!);
    await rm(original);
    await symlink(join(mediaDir(f.root, f.source.id), f.asset.file), original);
    await f.store.update(f.source.id, (p) => ({ ...p, assets: [f.asset] }));
    await assert.rejects(
      () => f.library.use(f.target.id, f.source.id, f.asset.id),
      /Source/,
    );
    assert.deepEqual(await readdir(mediaDir(f.root, f.target.id)), []);
    assert.deepEqual(await f.store.get(f.target.id), f.target);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("HTTP library selection delivers project-owned previews and exact original bytes", async () => {
  const f = await setup(),
    handler = api(f.store, new CommandService(f.store), f.root);
  const server = createServer(async (req, res) => {
    await handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const entries: LibraryAsset[] = await (
      await fetch(base + "/api/library")
    ).json();
    assert.equal(entries[0].projectId, f.source.id);
    const use = await fetch(base + `/api/projects/${f.target.id}/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceProjectId: f.source.id,
        assetId: f.asset.id,
      }),
    });
    assert.equal(use.status, 200);
    const result: { project: Project; asset: Asset } = await use.json();
    for (const [query, file] of [
      ["", f.asset.file],
      ["?poster=1", f.asset.poster!],
      ["?original=1&download=1", f.asset.original!],
    ]) {
      const response = await fetch(
        base + `/api/projects/${f.target.id}/media/${result.asset.id}` + query,
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "bytes:" + file);
    }
    const direct = await fetch(
      base + `/api/projects/${f.target.id}/media/${f.asset.id}`,
    );
    assert.equal(
      direct.status,
      404,
      "selection must not relax project ownership",
    );
    assert.deepEqual(await f.store.get(f.source.id), f.source);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await rm(f.root, { recursive: true, force: true });
  }
});
