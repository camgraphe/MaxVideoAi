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
