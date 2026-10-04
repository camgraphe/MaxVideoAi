import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
test("Vite cannot bypass the API to read server journals or environment files", async () => {
  const module = await import("../server/dev-server").catch(() => null);
  assert.ok(
    module?.createStudioVite,
    "Les données privées doivent être exclues du serveur de fichiers Vite",
  );
  const root = await mkdtemp(resolve(".private-studio-qa-"));
  const vite = await module.createStudioVite(root, {
    server: { hmr: false },
    logLevel: "silent",
  });
  const server = createServer(vite.middlewares);
  try {
    await writeFile(join(root, "journal.json"), '{"private":"reasoning"}');
    await writeFile(join(root, ".env.local"), "OPENAI_API_KEY=test-only");
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const filename of ["journal.json", ".env.local"]) {
      const res = await fetch(base + "/@fs/" + join(root, filename));
      assert.equal(res.status, 403);
      assert.ok(
        !(await res.text()).includes(
          filename === "journal.json" ? '"reasoning"' : "test-only",
        ),
      );
    }
    const app = await fetch(base + "/");
    assert.equal(app.status, 200);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await vite.close();
    await rm(root, { recursive: true, force: true });
  }
});
