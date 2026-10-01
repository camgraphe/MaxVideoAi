import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import { Director } from "../server/director";
import { mcp } from "../server/mcp";
import { api, acceptsLocalRequest, json } from "../server/http";
import { JobRunner } from "../server/jobs";
import { localWork } from "../server/local-work";
import { probeMedia, mediaDir } from "../server/media";
import type { Project } from "../shared/types";
test("HTTP brief → film → imports → MCP editing → immutable MP4 → durable restart and range delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-e2e-")),
    store = new ProjectStore(join(root, "projects")),
    service = new CommandService(store),
    director = new Director(service),
    runner = new JobRunner(store, localWork(root, store));
  let port = 0;
  const handle = api(store, service, root, {
      chat: (id, input) => director.respond(id, input),
      mcp: mcp(service),
    }),
    server = createServer(async (req, res) => {
      if (!acceptsLocalRequest(req, port)) {
        json(res, 403, { error: "Local only" });
        return;
      }
      if (!(await handle(req, res))) json(res, 404, {});
    });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const call = async (path: string, data?: unknown) => {
    const res = await fetch(
      base + path,
      data
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        : undefined,
    );
    const value = await res.json();
    assert.ok(res.ok, JSON.stringify(value));
    return value;
  };
  try {
    let p: Project = await call("/api/projects", { title: "E2E" }),
      url = "/api/projects/" + p.id;
    await call(url + "/commands", {
      requestId: "duration",
      expectedRevision: 0,
      command: { type: "settings", settings: { targetDuration: 10 } },
    });
    await call(url + "/chat", {
      requestId: "brief",
      text: "Fais une pub parfum lumineuse",
    });
    await runner.runOnce();
    p = await call(url);
    assert.equal(p.jobs[0].state, "ready");
    assert.equal(p.clips.length, 3);
    assert.equal(p.assets.length, 6);
    const invalid = await fetch(base + url + "/import", {
      method: "POST",
      body: "<svg></svg>",
    });
    assert.equal(invalid.status, 400);
    const imports = [
      {
        name: "reference.jpg",
        kind: "image",
        path: new URL("../public/demo/linen.jpg", import.meta.url),
      },
      {
        name: "reference.mp4",
        kind: "video",
        path: join(
          mediaDir(root, p.id),
          p.assets.find((a) => a.kind === "video")!.file,
        ),
      },
    ];
    for (const item of imports) {
      const bytes = await readFile(item.path);
      const response = await fetch(base + url + "/import", {
        method: "POST",
        headers: { "X-File-Name": item.name },
        body: new Uint8Array(bytes),
      });
      assert.equal(response.status, 201);
      p = await response.json();
      assert.equal(p.assets.at(-1)!.kind, item.kind);
      assert.ok(p.assets.at(-1)!.original);
    }
    const wave = await readFile(
      new URL(
        "../../../../frontend/public/studio/demo-ambient.wav",
        import.meta.url,
      ),
    );
    const imported = await fetch(base + url + "/import", {
      method: "POST",
      headers: { "X-File-Name": "reference.wav" },
      body: new Uint8Array(wave),
    });
    assert.equal(imported.status, 201);
    p = await imported.json();
    const audio = p.assets.at(-1)!;
    assert.equal(audio.kind, "audio");
    assert.equal(audio.peaks?.length, 128);
    assert.ok(audio.original);
    p = (
      await call(url + "/commands", {
        requestId: "audio",
        expectedRevision: p.revision,
        command: { type: "insert", assetId: audio.id, track: "music" },
      })
    ).project;
    const clipId = p.clips[0].id;
    const rpc = await call("/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "studio_trim_clip",
        arguments: {
          projectId: p.id,
          requestId: "trim",
          expectedRevision: p.revision,
          clipId,
          inFrame: 24,
          outFrame: 48,
        },
      },
    });
    assert.equal(rpc.result.isError, undefined);
    p = await call(url);
    const exportResult = await call(url + "/commands", {
      requestId: "export",
      command: { type: "export" },
    });
    const exportJob = exportResult.project.jobs.at(-1);
    await call(url + "/commands", {
      requestId: "format",
      expectedRevision: p.revision,
      command: { type: "settings", settings: { ratio: "9:16", fps: 30 } },
    });
    await runner.runOnce();
    p = await call(url);
    assert.equal(p.settings.ratio, "9:16");
    assert.equal(p.jobs.at(-1)!.state, "ready");
    const output = p.assets.find((a) => a.id === exportJob.outputIds[0])!,
      info = await probeMedia(join(mediaDir(root, p.id), output.file));
    assert.equal(info.width, 1280);
    assert.equal(info.height, 720);
    assert.equal(info.hasAudio, true);
    assert.equal(exportJob.snapshot.settings.fps, 24);
    const range = await fetch(base + url + "/media/" + output.id, {
      headers: { Range: "bytes=0-99" },
    });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 100);
    const badRange = await fetch(base + url + "/media/" + output.id, {
      headers: { Range: "bytes=99999999999-" },
    });
    assert.equal(badRange.status, 416);
    const foreign = await fetch(base + "/api/health", {
      headers: { Origin: "null" },
    });
    assert.equal(foreign.status, 403);
    const reloaded = await new ProjectStore(join(root, "projects")).get(p.id);
    assert.equal(reloaded.clips[0].inFrame, 30);
    assert.equal(reloaded.jobs.at(-1)!.outputIds[0], output.id);
    const replay = await call(url + "/commands", {
      requestId: "export",
      command: { type: "export" },
    });
    assert.equal(replay.replayed, true);
    assert.equal(
      replay.project.jobs.filter((j: any) => j.kind === "export").length,
      1,
    );
  } finally {
    await runner.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
