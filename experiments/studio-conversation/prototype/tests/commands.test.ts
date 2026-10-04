import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import type { Command } from "../shared/types";
import { fixture } from "./fixtures";
test("commands are durable, idempotent, serialized and reject stale revisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-command-"));
  try {
    const store = new ProjectStore(dir),
      p = await store.create("Test"),
      service = new CommandService(store);
    const req = {
      requestId: "first",
      expectedRevision: 0,
      command: {
        type: "settings" as const,
        settings: { ratio: "9:16" as const },
      },
    };
    const result = await service.execute(p.id, req);
    assert.equal(result.project.revision, 1);
    const reloaded = new CommandService(new ProjectStore(dir));
    const replay = await reloaded.execute(p.id, req);
    assert.equal(replay.replayed, true);
    assert.equal(replay.project.revision, 1);
    await assert.rejects(
      () =>
        reloaded.execute(p.id, {
          ...req,
          command: { type: "settings", settings: { ratio: "1:1" } },
        }),
      /identifiant/i,
    );
    const race = await Promise.allSettled(
      ["a", "b"].map((requestId) =>
        service.execute(p.id, {
          requestId,
          expectedRevision: 1,
          command: { type: "settings", settings: { fps: 30 } },
        }),
      ),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await store.get(p.id)).revision, 2);
    await assert.rejects(
      () =>
        service.execute(p.id, {
          requestId: "no-version",
          command: { type: "settings", settings: { fps: 24 } },
        }),
      /révision/i,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("request replay after restart retains a single job and output identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-job-command-"));
  try {
    const store = new ProjectStore(dir),
      p = await store.create(),
      service = new CommandService(store);
    const req = {
      requestId: "generation",
      command: { type: "images" as const, count: 3 },
    };
    const first = await service.execute(p.id, req),
      again = await new CommandService(new ProjectStore(dir)).execute(
        p.id,
        req,
      );
    assert.equal(first.jobId, again.jobId);
    assert.equal(again.project.jobs.length, 1);
    assert.equal(again.project.jobs[0].outputIds.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a complete editing session survives reload, replacement and undo without changing original media", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-edit-session-"));
  try {
    const store = new ProjectStore(dir),
      service = new CommandService(store);
    let p = await store.create("Editing session");
    const assets = [
      ...fixture().assets,
      {
        ...fixture().assets[0],
        id: "replacement",
        file: "replacement.mp4",
        duration: 4,
      },
    ];
    p = await store.update(p.id, (project) => ({
      ...project,
      assets,
      messages: [
        {
          id: "brief",
          role: "user",
          text: "Keep this conversation",
          createdAt: "",
        },
      ],
    }));
    const originals = structuredClone(p.assets);
    const edit = async (command: Command) => {
      p = (
        await service.execute(p.id, {
          requestId: crypto.randomUUID(),
          expectedRevision: p.revision,
          command,
        })
      ).project;
    };
    await edit({ type: "insert", assetId: "a" });
    const first = p.clips[0].id;
    await edit({ type: "insert", assetId: "a" });
    await edit({ type: "trim", clipId: first, inFrame: 24, outFrame: 144 });
    await edit({ type: "move", clipId: first, index: 1 });
    await edit({ type: "replace", clipId: first, assetId: "replacement" });
    assert.equal(p.clips[1].assetId, "replacement");
    assert.ok(
      p.clips[1].outFrame <= 96,
      "replacement cannot retain a trim past its source",
    );
    await edit({
      type: "insert",
      assetId: "b",
      track: "voice",
      startFrame: 48,
    });
    const voice = p.clips.find((c) => c.track === "voice")!;
    await edit({ type: "volume", clipId: voice.id, volume: 0.35 });
    await edit({ type: "move", clipId: voice.id, startFrame: 72 });
    const beforeDelete = structuredClone(p.clips);
    await edit({ type: "remove", clipId: first });
    const afterDelete = structuredClone(p.clips);
    await edit({ type: "undo" });
    assert.deepEqual(p.clips, beforeDelete);
    await edit({ type: "redo" });
    assert.deepEqual(p.clips, afterDelete);
    const reloaded = await new ProjectStore(dir).get(p.id);
    assert.deepEqual(reloaded.clips, afterDelete);
    assert.deepEqual(reloaded.assets, originals);
    assert.equal(reloaded.messages[0].text, "Keep this conversation");
    assert.equal(reloaded.clips.find((c) => c.id === voice.id)!.volume, 0.35);
    assert.equal(reloaded.clips.find((c) => c.id === voice.id)!.startFrame, 72);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("media and clips from another project cannot leak into an editing command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "studio-project-isolation-"));
  try {
    const store = new ProjectStore(dir),
      service = new CommandService(store);
    const first = await store.create("First"),
      other = await store.create("Other");
    await store.update(first.id, (p) => ({ ...p, assets: fixture().assets }));
    const edited = (
      await service.execute(first.id, {
        requestId: "insert",
        expectedRevision: 0,
        command: { type: "insert", assetId: "a" },
      })
    ).project;
    const savedFirst = await store.get(first.id);
    for (const command of [
      { type: "insert", assetId: "a" },
      { type: "trim", clipId: edited.clips[0].id, inFrame: 24, outFrame: 48 },
      { type: "replace", clipId: edited.clips[0].id, assetId: "a" },
    ] as Command[]) {
      await assert.rejects(() =>
        service.execute(other.id, {
          requestId: crypto.randomUUID(),
          expectedRevision: 0,
          command,
        }),
      );
    }
    assert.deepEqual(await store.get(other.id), other);
    assert.deepEqual(await store.get(first.id), savedFirst);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
