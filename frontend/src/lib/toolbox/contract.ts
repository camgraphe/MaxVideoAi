import { z } from 'zod';
import { getToolDefinition, type ToolId, type ToolMediaKind } from './catalogue';
import { finishingSettingsSchemas } from './finishing';

const id = z.string().trim().min(1).max(256);
const kind = z.enum(['image', 'video', 'audio']);
/** Use the exact ID returned by the library. Never guess an output index from a card ID. */
export const toolAssetRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('asset'), assetId: id, kind }).strict(),
  z.object({ type: z.literal('job-output'), jobId: id, outputId: id, kind }).strict(),
]);
export type ToolAssetRef = z.infer<typeof toolAssetRefSchema>;

const settings = {
  ...finishingSettingsSchemas,
  upscale: z.object({ mode: z.enum(['factor', 'target']), factor: z.union([z.literal(2), z.literal(4)]), targetResolution: z.enum(['720p', '1080p', '1440p', '2160p']), outputFormat: z.enum(['jpg', 'png', 'webp', 'mp4', 'webm', 'mov', 'gif']) }).strict(),
  'background-removal': z.object({ backgroundColor: z.enum(['Transparent', 'Black', 'White', 'Gray', 'Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'Orange']), outputCodec: z.enum(['webm_vp9', 'mp4_h264', 'mp4_h265', 'mov_h265', 'mkv_h265', 'mkv_h264', 'mkv_vp9', 'avi_h264', 'gif']), preserveAudio: z.boolean() }).strict(),
  angle: z.object({ rotation: z.number().finite().min(-180).max(180), tilt: z.number().finite().min(-90).max(90), zoom: z.number().finite().positive(), safeMode: z.boolean(), generateBestAngles: z.boolean() }).strict(),
};

export type QuickToolSettings = z.infer<typeof settings.upscale> | z.infer<typeof settings['background-removal']>;
export type ToolBlock = {
  toolId: ToolId;
  version: 1;
  inputs: ToolAssetRef[];
  settings: Record<string, unknown>;
};
export type ToolResult = {
  toolId: ToolId;
  version: 1;
  jobId: string;
  sourceAssets: ToolAssetRef[];
  outputs: Array<{ asset: ToolAssetRef; originalUrl: string; thumbnailUrl?: string | null; kind: ToolMediaKind }>;
};
export type ToolRunState =
  | { status: 'idle' | 'preparing' }
  | { status: 'quoted'; totalCents: number; currency: string; inputKey: string }
  | { status: 'running'; jobId?: string }
  | { status: 'completed'; result: ToolResult }
  | { status: 'failed'; message: string; jobId?: string };

/** Structural eligibility only. Server resolution must still verify ownership, URLs and metadata. */
export function validateToolBlock(value: unknown): ToolBlock {
  const block = z.object({ toolId: z.string(), version: z.literal(1), inputs: z.array(toolAssetRefSchema), settings: z.record(z.unknown()) }).strict().parse(value);
  const tool = getToolDefinition(block.toolId);
  if (!tool) throw new Error('Tool is unavailable.');
  if (block.inputs.length < tool.minInputs || block.inputs.length > tool.maxInputs) throw new Error('Unsupported input count.');
  if (block.inputs.some((input) => !tool.inputKinds.includes(input.kind))) throw new Error('Unsupported media kind.');
  const schema = settings[tool.id as keyof typeof settings];
  // Workshop settings remain under their existing owners; no new execution is enabled here.
  if (!schema) throw new Error('Use the existing workshop adapter.');
  const parsed = schema.parse(block.settings);
  if (tool.id === 'upscale') {
    const format = (parsed as z.infer<typeof settings.upscale>).outputFormat;
    const imageOutput = ['jpg', 'png', 'webp'].includes(format);
    if (imageOutput !== (block.inputs[0].kind === 'image')) throw new Error('Output format does not match input kind.');
  }
  return { toolId: tool.id, version: 1, inputs: block.inputs, settings: parsed };
}
