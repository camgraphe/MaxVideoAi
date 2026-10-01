import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../server/store";
import { CommandService } from "../server/commands";
import { waitForJob } from "../server/job-wait";

test("A wait timeout leaves pending jobs, receipts and project bytes untouched", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-wait-timeout-"));
  try {
    const store = new ProjectStore(root),
      service = new CommandService(store),
      p = await store.create();
    const result = await service.execute(p.id, {
      requestId: "voice",
      command: { type: "voice", text: "Bonjour" },
    });
    const before = await readFile(store.path(p.id));
    const output = await waitForJob(store, p.id, result.jobId!, 0);
    assert.equal(output.timedOut, true);
    assert.equal(output.job.state, "queued");
    assert.equal(output.revisionChanged, false);
    assert.ok((await readFile(store.path(p.id))).equals(before));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
