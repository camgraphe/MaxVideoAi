import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import { MediaLibraryService } from "../server/library";
import { mediaDir } from "../server/media";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "studio-ai-"));
  const store = new ProjectStore(join(root, "projects"));
  const service = new CommandService(store);
  const p = await store.create("Film QA");
  await store.update(p.id, (p) => {
    p.assets.push({
      id: "video",
      name: "La mer",
      kind: "video",
      file: "source.mp4",
      duration: 10,
      width: 320,
      height: 180,
      hasAudio: false,
      origin: "import",
    });
    return p;
  });
  const inserted = await service.execute(p.id, {
    requestId: "insert",
    expectedRevision: 0,
    command: { type: "insert", assetId: "video" },
  });
  const module = await import("../server/ai-director").catch(() => null);
  assert.ok(
    module?.AiDirector,
    "Le directeur IA doit pouvoir remplacer le simulateur",
  );
  const make = (client: any) =>
    new module.AiDirector(
      service,
      new MediaLibraryService(store, root),
      root,
      client,
    );
  return {
    root,
    store,
    service,
    id: p.id,
    clipId: inserted.project.clips[0].id,
    make,
  };
}
const final = (text: string) => ({
  id: "resp-final",
  status: "completed",
  output: [
    {
      type: "message",
      id: "msg-final",
      role: "assistant",
      status: "completed",
      phase: "final_answer",
      content: [{ type: "output_text", text, annotations: [] }],
    },
  ],
});
const edit = (clipId: string) => ({
  id: "resp-cut",
  status: "completed",
  output: [
    {
      type: "reasoning",
      id: "reasoning-cut",
      summary: [],
      encrypted_content: "opaque-reasoning",
    },
    {
      type: "message",
      id: "commentary-cut",
      role: "assistant",
      status: "completed",
      phase: "commentary",
      content: [
        {
          type: "output_text",
          text: "Je raccourcis ce plan.",
          annotations: [],
        },
      ],
    },
    {
      type: "function_call",
      id: "fc-cut",
      status: "completed",
      call_id: "call-cut",
      name: "studio_edit",
      arguments: JSON.stringify({
        expectedRevision: 1,
        command: { type: "trim", clipId, inFrame: 48, outFrame: 144 },
      }),
    },
  ],
});

test("Sol executes an intent through shared commands and completed requests replay after restart", async () => {
  const f = await fixture();
  try {
    let rounds = 0;
    const client = {
      create: async (request: any) => {
        rounds++;
        if (rounds === 1) return edit(f.clipId);
        const output = request.input.find(
          (i: any) => i.type === "function_call_output",
        );
        assert.equal(JSON.parse(output.output).project.clips[0].outFrame, 144);
        assert.ok(
          request.input.some(
            (i: any) => i.encrypted_content === "opaque-reasoning",
          ),
        );
        assert.ok(request.input.some((i: any) => i.phase === "commentary"));
        return final("J’ai gardé les quatre secondes centrales du plan.");
      },
    };
    const input = {
      requestId: "creative-brief",
      text: "Garde seulement le passage le plus calme au milieu de la mer.",
    };
    const result = await f.make(client).respond(f.id, input);
    assert.equal(result.project.clips[0].inFrame, 48);
    assert.equal(result.project.clips[0].outFrame, 144);
    assert.equal(result.project.revision, 2);
    assert.equal(
      result.project.messages.at(-1)?.text,
      "J’ai gardé les quatre secondes centrales du plan.",
    );
    assert.ok(
      result.project.messages.some(
        (m) => m.role === "assistant" && m.text === "Je raccourcis ce plan.",
      ),
      "La proposition avant l’action doit rester visible dans le chat",
    );
    await f.make(client).respond(f.id, input);
    assert.equal(rounds, 2);
    assert.equal(
      (await f.store.get(f.id)).messages.filter((m) => m.role === "user")
        .length,
      1,
    );
    await assert.rejects(
      f.make(client).respond(f.id, { ...input, text: "Une autre demande" }),
      /identifiant/i,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("An API failure after an edit can resume without repeating the edit or losing conversation", async () => {
  const f = await fixture();
  try {
    let rounds = 0;
    const director = f.make({
      create: async () => {
        if (++rounds === 1) return edit(f.clipId);
        throw new Error("API indisponible");
      },
    });
    const input = { requestId: "interrupted", text: "Coupe au milieu" };
    await assert.rejects(
      director.respond(f.id, input),
      /indisponible|interrompu/i,
    );
    const failed = await f.store.get(f.id);
    assert.equal(failed.revision, 2);
    assert.equal(failed.assistantRun?.state, "failed");
    assert.ok(!failed.messages.some((m) => m.id === "sol:interrupted"));
    const restarted = f.make({
      create: async (request: any) => {
        assert.ok(
          request.input.some(
            (i: any) =>
              i.type === "function_call_output" && i.call_id === "call-cut",
          ),
        );
        return final("La coupe est enregistrée.");
      },
    });
    await restarted.retry(f.id, input.requestId);
    const complete = await f.store.get(f.id);
    assert.equal(complete.revision, 2);
    assert.equal(complete.messages.filter((m) => m.role === "user").length, 1);
    assert.equal(
      complete.messages.filter((m) => m.role === "assistant").length,
      2,
    );
    assert.equal(complete.assistantRun, undefined);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("A concurrent manual edit wins over an outdated model action", async () => {
  const f = await fixture();
  try {
    let rounds = 0;
    await f
      .make({
        create: async (request: any) => {
          if (++rounds === 1) {
            await f.service.execute(f.id, {
              requestId: "manual",
              expectedRevision: 1,
              command: { type: "volume", clipId: f.clipId, volume: 0.5 },
            });
            return edit(f.clipId);
          }
          const output = request.input.find(
            (i: any) => i.type === "function_call_output",
          );
          assert.equal(JSON.parse(output.output).error.status, 409);
          return final("Votre modification a été conservée.");
        },
      })
      .respond(f.id, { requestId: "race", text: "Raccourcis" });
    const p = await f.store.get(f.id);
    assert.equal(p.revision, 2);
    assert.equal(p.clips[0].outFrame, 240);
    assert.equal(p.clips[0].volume, 0.5);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("Owned images are sent and foreign references are rejected before saving a turn", async () => {
  const f = await fixture();
  try {
    const filename = crypto.randomUUID() + ".jpg";
    await mkdir(mediaDir(f.root, f.id), { recursive: true });
    await writeFile(
      join(mediaDir(f.root, f.id), filename),
      Buffer.from("reference-jpeg"),
    );
    await f.store.update(f.id, (p) => {
      p.assets.push({
        id: "image",
        name: "Référence",
        kind: "image",
        file: filename,
        duration: 0,
        width: 200,
        height: 200,
        hasAudio: false,
        origin: "import",
      });
      return p;
    });
    const director = f.make({
      create: async (request: any) => {
        const user = request.input.at(-1);
        assert.ok(
          user.content.some(
            (c: any) =>
              c.type === "input_image" &&
              c.image_url === "data:image/jpeg;base64,cmVmZXJlbmNlLWpwZWc=",
          ),
        );
        assert.ok(!request.instructions.includes(filename));
        return final("La référence est lumineuse.");
      },
    });
    await director.respond(f.id, {
      requestId: "reference",
      text: "Prends cette direction",
      context: { assetIds: ["image"] },
    });
    await assert.rejects(
      director.respond(f.id, {
        requestId: "foreign-reference",
        text: "Utilise cette image",
        context: { assetIds: ["foreign"] },
      }),
      /référence|média/i,
    );
    assert.equal(
      (await f.store.get(f.id)).messages.filter((m) => m.role === "user")
        .length,
      1,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("Incomplete provider output never applies a suggested action", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f
        .make({
          create: async () => ({ ...edit(f.clipId), status: "incomplete" }),
        })
        .respond(f.id, { requestId: "incomplete", text: "Coupe" }),
      /incompl|interrompu/i,
    );
    assert.equal((await f.store.get(f.id)).revision, 1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("A restart between command commit and checkpoint replays the same receipt", async () => {
  const f = await fixture();
  try {
    let round = 0;
    await assert.rejects(
      f
        .make({
          create: async () => {
            if (++round === 1) return edit(f.clipId);
            throw new Error("interruption");
          },
        })
        .respond(f.id, { requestId: "crash-window", text: "Coupe ce plan" }),
    );
    const path = join(f.root, "assistant", f.id + ".json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    // Recreate the durable state just before storing the successful tool output.
    journal.items = journal.items.filter(
      (i: any) => i.type !== "function_call_output",
    );
    journal.pending = edit(f.clipId).output.filter(
      (i) => i.type === "function_call",
    );
    await writeFile(path, JSON.stringify(journal));
    const restarted = f.make({
      create: async () => final("Coupe enregistrée."),
    });
    await restarted.retry(f.id, "crash-window");
    assert.equal((await f.store.get(f.id)).revision, 2);
    assert.equal((await f.store.get(f.id)).undo.length, 2);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("Recovery reconciles a committed final message with an unfinished journal", async () => {
  const f = await fixture();
  try {
    const director = f.make({
      create: async () => final("Premier échange terminé."),
    });
    await director.respond(f.id, { requestId: "first", text: "Bonjour" });
    const path = join(f.root, "assistant", f.id + ".json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.state = "running";
    await writeFile(path, JSON.stringify(journal));
    const restarted = f.make({
      create: async () => final("Je me souviens de notre échange."),
    });
    await restarted.recover();
    await restarted.respond(f.id, { requestId: "second", text: "On continue" });
    assert.equal((await f.store.get(f.id)).messages.length, 4);
    assert.equal((await f.store.get(f.id)).assistantRun, undefined);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
