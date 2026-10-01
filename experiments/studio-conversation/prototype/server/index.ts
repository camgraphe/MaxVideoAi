import { Director } from "./director";
import { mcp } from "./mcp";
import { createServer } from "node:http";
import { createStudioVite } from "./dev-server";
import { resolve } from "node:path";
import { ProjectStore } from "./store";
import { CommandService } from "./commands";
import { JobRunner } from "./jobs";
import { localWork } from "./local-work";
import { api, json, acceptsLocalRequest } from "./http";
import { existsSync } from "node:fs";
import { AiDirector } from "./ai-director";
import { OpenAIResponses } from "./openai-client";
import { MediaLibraryService } from "./library";
import { StudioActions } from "./studio-actions";
const envFile = process.env.STUDIO_ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.STUDIO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const assistantMode = process.env.STUDIO_ASSISTANT ?? (key ? "openai" : "demo");
if (!["openai", "demo"].includes(assistantMode))
  throw new Error("STUDIO_ASSISTANT doit être openai ou demo.");
const port = Number(process.env.STUDIO_LOCAL_PORT ?? 4318),
  root = resolve(process.env.STUDIO_LOCAL_DATA ?? ".data");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Port local invalide.");
const store = new ProjectStore(resolve(root, "projects")),
  service = new CommandService(store),
  runner = new JobRunner(store, localWork(root, store)),
  library = new MediaLibraryService(store, root),
  actions = new StudioActions(service, library),
  ai =
    assistantMode === "openai"
      ? new AiDirector(service, library, root, new OpenAIResponses(key))
      : undefined;
const vite = await createStudioVite(root),
  director = ai ?? new Director(service),
  handle = api(store, service, root, {
    chat: (id, data) => director.respond(id, data),
    retryChat: ai ? (id, requestId) => ai.retry(id, requestId) : undefined,
    assistant: {
      mode: assistantMode as "openai" | "demo",
      model: ai ? "gpt-6.1-sol" : undefined,
      configured: assistantMode === "demo" || !!key,
    },
    mcp: mcp(service, actions),
  });
const server = createServer(async (req, res) => {
  if (!acceptsLocalRequest(req, port)) {
    json(res, 403, {
      error: "Ce prototype accepte uniquement les requêtes locales.",
    });
    return;
  }
  if (await handle(req, res)) return;
  vite.middlewares(req, res);
});
await runner.recover();
await ai?.recover();
runner.start();
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Studio local prêt : http://127.0.0.1:${port} · ${ai ? "GPT-6.1 Sol" : "Démonstration"}`,
  ),
);
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, () => {
    void (async () => {
      await runner.stop();
      await vite.close();
      server.close(() => process.exit(0));
    })();
  });
