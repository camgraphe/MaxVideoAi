import { CommandService } from "./commands";
import { StudioError } from "../shared/timeline";
import type { Command } from "../shared/types";
import { actionTools, StudioActions } from "./studio-actions";
const fields = {
  projectId: { type: "string" },
  requestId: {
    type: "string",
    description:
      "Stable across retries. A different payload requires a new ID.",
  },
  expectedRevision: {
    type: "integer",
    description: "Required for every edit; read current project first.",
  },
};
const schema = (
  extra: Record<string, unknown> = {},
  required: string[] = ["projectId"],
) => ({
  type: "object",
  properties: { ...fields, ...extra },
  required,
  additionalProperties: false,
});
const tools = [
  {
    name: "studio_list_projects",
    description: "List saved local Studio projects.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "studio_get_project",
    description: "Read media, messages, sequence revision and durable jobs.",
    inputSchema: schema(),
  },
  {
    name: "studio_create_project",
    description: "Create a local project.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "studio_trim_clip",
    description:
      "Trim source in/out in integer sequence frames. Minimum 1 second. Same command as Studio UI.",
    inputSchema: schema(
      {
        clipId: { type: "string" },
        inFrame: { type: "integer" },
        outFrame: { type: "integer" },
      },
      [
        "projectId",
        "requestId",
        "expectedRevision",
        "clipId",
        "inFrame",
        "outFrame",
      ],
    ),
  },
  {
    name: "studio_move_clip",
    description:
      "Reorder a video clip by zero-based index or place audio at startFrame.",
    inputSchema: schema(
      {
        clipId: { type: "string" },
        index: { type: "integer" },
        startFrame: { type: "integer" },
      },
      ["projectId", "requestId", "expectedRevision", "clipId"],
    ),
  },
  {
    name: "studio_command",
    description:
      "Run shared Studio commands: settings, insert, replace, remove, assemble, volume, undo/redo, images, animate, voice, music, export, cancel/retry. Demo generation only; export renders real media. All edit commands require expectedRevision.",
    inputSchema: schema(
      {
        command: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "settings",
                "insert",
                "replace",
                "remove",
                "assemble",
                "volume",
                "undo",
                "redo",
                "images",
                "animate",
                "voice",
                "music",
                "export",
                "cancel",
                "retry",
              ],
            },
          },
          required: ["type"],
        },
      },
      ["projectId", "requestId", "command"],
    ),
  },
];
export function mcp(service: CommandService, actions?: StudioActions) {
  return async (request: any): Promise<any> => {
    const ok = (result: unknown) => ({
        jsonrpc: "2.0",
        id: request.id,
        result,
      }),
      error = (code: number, message: string) => ({
        jsonrpc: "2.0",
        id: request?.id ?? null,
        error: { code, message },
      });
    if (
      !request ||
      request.jsonrpc !== "2.0" ||
      typeof request.method !== "string"
    )
      return error(-32600, "Invalid Request");
    if (request.id === undefined) return undefined;
    if (request.method === "initialize")
      return ok({
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "MaxVideoAI Studio Local", version: "0.1.0" },
        instructions:
          "Local prototype. Read revision before editing; keep requestId stable on retry. Jobs run asynchronously and results are saved in the project.",
      });
    if (request.method === "ping") return ok({});
    if (request.method === "tools/list")
      return ok({
        tools: [
          ...tools,
          ...(actions
            ? actionTools.map(({ name, description, parameters }) => ({
                name,
                description,
                inputSchema: {
                  ...parameters,
                  properties: {
                    ...parameters.properties,
                    projectId: fields.projectId,
                    requestId: fields.requestId,
                  },
                  required: [...parameters.required, "projectId", "requestId"],
                },
              }))
            : []),
        ],
      });
    if (request.method !== "tools/call")
      return error(-32601, "Method not found");
    try {
      const { name, arguments: a = {} } = request.params ?? {};
      let result: unknown;
      if (actions && actionTools.some((t) => t.name === name)) {
        const { projectId, requestId, ...args } = a;
        result = await actions.execute(projectId, requestId, name, args);
      } else if (name === "studio_list_projects")
        result = (await service.store.list()).map((p) => ({
          id: p.id,
          title: p.title,
          revision: p.revision,
        }));
      else if (name === "studio_get_project")
        result = await service.store.get(a.projectId);
      else if (name === "studio_create_project")
        result = await service.store.create(a.title);
      else {
        let command: Command;
        if (name === "studio_trim_clip")
          command = {
            type: "trim",
            clipId: a.clipId,
            inFrame: a.inFrame,
            outFrame: a.outFrame,
          };
        else if (name === "studio_move_clip")
          command = {
            type: "move",
            clipId: a.clipId,
            index: a.index,
            startFrame: a.startFrame,
          };
        else if (name === "studio_command") command = a.command;
        else throw new StudioError("Unknown tool.");
        result = await service.execute(a.projectId, {
          requestId: a.requestId,
          expectedRevision: a.expectedRevision,
          command,
        });
      }
      return ok({ content: [{ type: "text", text: JSON.stringify(result) }] });
    } catch (e) {
      return ok({
        isError: true,
        content: [
          {
            type: "text",
            text: e instanceof Error ? e.message : "Tool failed.",
          },
        ],
      });
    }
  };
}
