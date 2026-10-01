import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ProjectStore } from "./store";
import { CommandService } from "./commands";
import { importMedia, mediaDir } from "./media";
import { StudioError } from "../shared/timeline";
import { MediaLibraryService } from "./library";
import type { AssistantInfo } from "../shared/types";
export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
export async function body(
  req: IncomingMessage,
  max = 1024 * 1024,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max)
      throw new StudioError("Fichier ou requête trop volumineux.", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export interface Adapters {
  chat?: (id: string, data: any) => Promise<unknown>;
  mcp?: (data: any) => Promise<unknown>;
  retryChat?: (id: string, requestId: string) => Promise<unknown>;
  assistant?: AssistantInfo;
}
export function api(
  store: ProjectStore,
  service: CommandService,
  root: string,
  adapters: Adapters = {},
) {
  const library = new MediaLibraryService(store, root);
  return async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1"),
      path = url.pathname,
      method = req.method;
    if (!path.startsWith("/api/") && path !== "/mcp") return false;
    try {
      if (path === "/api/health") {
        const assistant = adapters.assistant ?? {
          mode: "demo",
          configured: true,
        };
        json(res, 200, {
          status: "ready",
          mode: assistant.mode === "openai" ? "local-ai" : "local-demo",
          assistant,
        });
        return true;
      }
      if (path === "/api/library" && method === "GET") {
        json(res, 200, await library.list());
        return true;
      }
      if (path === "/mcp" && method === "POST" && adapters.mcp) {
        const response = await adapters.mcp(
          JSON.parse((await body(req)).toString()),
        );
        if (response === undefined) {
          res.writeHead(202);
          res.end();
        } else json(res, 200, response);
        return true;
      }
      if (path === "/api/projects") {
        if (method === "GET")
          json(
            res,
            200,
            (await store.list()).map((p) => ({
              id: p.id,
              title: p.title,
              updatedAt: p.updatedAt,
            })),
          );
        else if (method === "POST")
          json(
            res,
            201,
            await store.create(JSON.parse((await body(req)).toString()).title),
          );
        else throw new StudioError("Méthode invalide.", 405);
        return true;
      }
      const match = path.match(
        /^\/api\/projects\/([a-f0-9-]{36})(?:\/(commands|chat|retry-chat|import|media|backup|library)(?:\/([a-f0-9-]{36}))?)?$/,
      );
      if (!match) throw new StudioError("Route introuvable.", 404);
      const [, id, action, assetId] = match;
      const p = await store.get(id);
      if (!action && method === "GET") {
        json(res, 200, p);
        return true;
      }
      if (action === "commands" && method === "POST") {
        json(
          res,
          200,
          await service.execute(id, JSON.parse((await body(req)).toString())),
        );
        return true;
      }
      if (action === "library" && method === "POST") {
        const data = JSON.parse((await body(req)).toString());
        json(
          res,
          200,
          await library.use(id, data.sourceProjectId, data.assetId),
        );
        return true;
      }
      if (action === "chat" && method === "POST" && adapters.chat) {
        json(
          res,
          200,
          await adapters.chat(id, JSON.parse((await body(req)).toString())),
        );
        return true;
      }
      if (action === "retry-chat" && method === "POST" && adapters.retryChat) {
        const data = JSON.parse((await body(req)).toString());
        json(res, 200, await adapters.retryChat(id, data.requestId));
        return true;
      }
      if (action === "import" && method === "POST") {
        const asset = await importMedia(
          root,
          id,
          await body(req, 100 * 1024 * 1024),
          decodeURIComponent(String(req.headers["x-file-name"] ?? "Référence")),
        );
        const project = await store.update(id, (p) => {
          p.assets.push(asset);
          p.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            text: "Référence ajoutée : " + asset.name,
            assets: [asset.id],
            createdAt: new Date().toISOString(),
          });
          return p;
        });
        json(res, 201, project);
        return true;
      }
      if (action === "backup" && method === "GET") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="studio-${id}.json"`,
        );
        json(res, 200, p);
        return true;
      }
      if (action === "media" && method === "GET") {
        const a = p.assets.find((a) => a.id === assetId);
        if (!a) throw new StudioError("Média introuvable.", 404);
        const file = url.searchParams.has("original")
          ? (a.original ?? a.file)
          : url.searchParams.has("poster")
            ? (a.poster ?? a.file)
            : a.file;
        if (!/^[a-f0-9-]{36}\.(jpg|mp4|mp3|original)$/.test(file))
          throw new StudioError("Chemin invalide.");
        const full = join(mediaDir(root, id), file),
          info = await stat(full),
          type = file.endsWith(".jpg")
            ? "image/jpeg"
            : file.endsWith(".mp4")
              ? "video/mp4"
              : file.endsWith(".mp3")
                ? "audio/mpeg"
                : "application/octet-stream";
        const headers: Record<string, string | number> = {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        };
        if (url.searchParams.has("download"))
          headers["Content-Disposition"] =
            `attachment; filename="studio-${a.id}.${file.split(".").at(-1)}"`;
        let start = 0,
          end = info.size - 1,
          status = 200;
        if (req.headers.range) {
          const range = req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
          if (!range || (!range[1] && !range[2]))
            throw new StudioError("Plage invalide.", 416);
          if (!range[1]) start = Math.max(0, info.size - Number(range[2]));
          else {
            start = Number(range[1]);
            if (range[2]) end = Math.min(end, Number(range[2]));
          }
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= info.size
          ) {
            res.setHeader("Content-Range", `bytes */${info.size}`);
            throw new StudioError("Plage invalide.", 416);
          }
          status = 206;
          headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
        }
        headers["Content-Length"] = end - start + 1;
        res.writeHead(status, headers);
        const stream = createReadStream(full, { start, end });
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        stream.pipe(res);
        return true;
      }
      throw new StudioError("Route introuvable.", 404);
    } catch (e) {
      json(res, e instanceof StudioError ? e.status : 400, {
        error: e instanceof Error ? e.message : "Une erreur est survenue.",
      });
      return true;
    }
  };
}
export function acceptsLocalRequest(
  req: Pick<IncomingMessage, "headers">,
  port: number,
): boolean {
  const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (
    !allowed.has(req.headers.host ?? "") ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return false;
  if (req.headers.origin) {
    try {
      const origin = new URL(req.headers.origin);
      if (origin.protocol !== "http:" || !allowed.has(origin.host))
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
