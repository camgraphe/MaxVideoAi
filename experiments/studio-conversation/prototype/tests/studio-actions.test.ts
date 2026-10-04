import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import { MediaLibraryService } from "../server/library";
import { StudioActions } from "../server/studio-actions";
import { mcp } from "../server/mcp";
import { mediaDir } from "../server/media";
import { JobRunner } from "../server/jobs";
test("MCP and the director share library adoption, typed editing and ownership checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-actions-"));
  try {
    const store = new ProjectStore(join(root, "projects")),
      service = new CommandService(store),
      library = new MediaLibraryService(store, root),
      actions = new StudioActions(service, library);
    const source = await store.create("Références"),
      target = await store.create("Montage");
    const assetId = crypto.randomUUID(),
      filename = assetId + ".mp4";
    await mkdir(mediaDir(root, source.id), { recursive: true });
    await writeFile(join(mediaDir(root, source.id), filename), "image");
    await store.update(source.id, (p) => {
      p.assets.push({
        id: assetId,
        name: "Produit",
        kind: "video",
        file: filename,
        duration: 8,
        width: 320,
        height: 180,
        hasAudio: false,
        origin: "import",
      });
      return p;
    });
    const sourceBefore = await store.get(source.id);
    const handle = mcp(service, actions);
    const discovery = await handle({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    assert.ok(
      discovery.result.tools.some((t: any) => t.name === "studio_use_media"),
      "Le MCP doit exposer la même bibliothèque que Sol",
    );
    const call = async (name: string, a: any) =>
      handle({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name,
          arguments: { projectId: target.id, requestId: "mcp-adopt", ...a },
        },
      });
    const result = await call("studio_use_media", {
      sourceProjectId: source.id,
      assetId,
    });
    assert.equal(result.result.isError, undefined);
    const adopted = JSON.parse(result.result.content[0].text).assetId;
    await call("studio_use_media", { sourceProjectId: source.id, assetId });
    assert.equal((await store.get(target.id)).assets.length, 1);
    const edit = {
      expectedRevision: 0,
      command: {
        type: "insert",
        assetId: adopted,
        track: "video",
        index: null,
        startFrame: null,
      },
    };
    await call("studio_edit", { ...edit, requestId: "mcp-insert" });
    assert.equal((await store.get(target.id)).clips.length, 1);
    await assert.rejects(
      actions.execute(target.id, "foreign", "studio_edit", {
        ...edit,
        expectedRevision: 1,
        command: { ...edit.command, assetId },
      }),
      /média/i,
    );
    await assert.rejects(
      actions.execute(target.id, "unknown", "studio_generate", {
        command: { type: "shell", text: "anything" },
      }),
      /arguments/i,
    );
    assert.deepEqual(await store.get(source.id), sourceBefore);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("A shared wait returns a slow job's canonical output without running it twice", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-wait-"));
  const store = new ProjectStore(join(root, "projects"));
  const service = new CommandService(store);
  const actions = new StudioActions(
    service,
    new MediaLibraryService(store, root),
  );
  try {
    const p = await store.create("Voix"),
      other = await store.create("Autre");
    const result = await service.execute(p.id, {
      requestId: "voice",
      command: { type: "voice", text: "Bonjour" },
    });
    let processed = 0;
    const runner = new JobRunner(store, async (_p, job) => {
      processed++;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return [
        {
          id: job.outputIds[0],
          name: "Bonjour",
          kind: "audio",
          file: job.outputIds[0] + ".mp3",
          duration: 2,
          width: 0,
          height: 0,
          hasAudio: true,
          origin: "local",
        },
      ];
    });
    const [output] = (await Promise.all([
      actions.execute(p.id, "wait", "studio_wait", { jobId: result.jobId }),
      runner.runOnce(),
    ])) as any[];
    assert.equal(output.job.state, "ready");
    assert.equal(
      output.project.assets[0].id,
      result.project.jobs[0].outputIds[0],
    );
    assert.equal(processed, 1);
    await actions.execute(p.id, "wait-again", "studio_wait", {
      jobId: result.jobId,
    });
    assert.equal(processed, 1);
    await assert.rejects(
      actions.execute(other.id, "foreign", "studio_wait", {
        jobId: result.jobId,
      }),
      /introuvable/i,
    );
    const cancelled = await service.execute(p.id, {
      requestId: "another",
      command: { type: "voice", text: "Bonsoir" },
    });
    await service.execute(p.id, {
      requestId: "cancel",
      command: { type: "cancel", jobId: cancelled.jobId! },
    });
    const terminal = (await actions.execute(
      p.id,
      "wait-cancelled",
      "studio_wait",
      { jobId: cancelled.jobId },
    )) as any;
    assert.equal(terminal.job.state, "cancelled");
    assert.equal(processed, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
