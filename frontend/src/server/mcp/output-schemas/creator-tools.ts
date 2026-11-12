import * as z from 'zod/v4';
import { mediaKind, money, strings } from './common';

const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const toolId = z.enum(['subtitles', 'lip-sync', 'product-photo-editor', 'product-video-editor', 'motion-transfer']);
const asset = z.discriminatedUnion('type', [
  object({ type: z.literal('asset'), assetId: z.string(), kind: mediaKind }),
  object({ type: z.literal('job-output'), jobId: z.string(), outputId: z.string(), kind: mediaKind }),
]);
const audioPolicy = z.enum(['preserve', 'mute']);
const profile = object({
  id: z.string(), toolId, revision: z.number(), qualification: z.enum(['canonical', 'tool-specific', 'closed']),
  disclosure: z.string(), deploymentGateOpen: z.boolean().optional(),
  constraints: object({
    sourceKinds: z.array(mediaKind), audioPolicies: z.array(audioPolicy), resolution: z.enum(['provider', 'selectable']),
    duration: object({ min: z.number(), max: z.number(), wholeSeconds: z.boolean(),
      matchingAudioVideo: z.boolean().optional(), maxByOrientation: object({ image: z.number(), video: z.number() }).optional(),
    }).optional(),
    minVideoFps: z.number().optional(), maxSourceBytes: z.number().optional(),
    pixelPreservation: z.boolean().optional(), acceptsInstruction: z.boolean().optional(),
  }),
});
export const listCreatorToolsOutputSchema = object({
  executionSurface: z.enum(['mcp', 'studio']).optional(), directExecutionEnabled: z.boolean().optional(),
  tools: z.array(object({ id: toolId, source: strings, profiles: z.array(z.union([
    profile, object({ id: z.string(), editing: z.string(), exports: strings,
      deploymentGateOpen: z.boolean().optional(), webDeploymentGateOpen: z.boolean().optional() }),
  ])), web: object({ url: z.string().url(), publicReleased: z.boolean(), executionGateOpen: z.boolean() }).optional() })),
  webTools: z.array(object({
    id: z.string(), inputKinds: strings, outputKinds: strings, url: z.string().url(),
    mcpExecution: z.literal(false), providerReadiness: z.literal('not-checked'),
    release: z.enum(['public-web-entry', 'owner-approved-pilot', 'qualified', 'profile-dependent']),
    profiles: z.array(object({ id: z.string(), quality: z.enum(['standard', 'pro']),
      release: z.enum(['owner-approved-pilot', 'qualified']) })),
  })).optional(),
  webHandoff: object({ startsOperation: z.literal(false), transfersMedia: z.literal(false),
    requiresSourceSelection: z.literal(true), requiresWebQuoteApproval: z.literal(true) }).optional(),
  requiresExactQuoteApproval: z.literal(true), statusPolling: z.string(),
});
const quote = object({
  price: money, expiresAt: z.string(),
  breakdown: object({ transcription: money, mixPreparation: money }).optional(),
});
const result = z.union([
  object({
    toolId, version: z.literal(1), jobId: z.string(), sourceAssets: z.array(asset),
    outputs: z.array(object({ asset, originalUrl: z.string(), openUrl:z.string().url().optional(), kind: z.enum(['image', 'video']),
      thumbnailUrl: z.string().nullable().optional(), durationSec: z.number().optional(),
      audioPolicy: audioPolicy.optional(), audioEncoding: z.enum(['source', 'aac']).optional(),
    })),
  }),
  // Transcription and MP4 publication both retain document/revision; publication
  // adds the exact owned media reference and original/read URLs.
  object({ documentId: z.string(), revision: z.number(), ref: asset.optional(),
    assetId: z.string().optional(), originalUrl: z.string().optional(), openUrl:z.string().url().optional(), thumbnailUrl: z.string().nullable().optional(),
  }),
]);
const subtitleState = z.enum(['prepared', 'queued', 'running', 'completed', 'failed']);
const subtitleKind = z.enum(['transcribe', 'render', 'mix-transcribe']);
const preparedSubtitle = object({
  source: asset.nullable(), settings: object({ keyterms: strings, language: z.string().optional() }),
  document: object({ id: z.string(), revision: z.number() }).optional(),
  sequence: object({ projectId: z.string(), sequenceId: z.string(), expectedRevision: z.number() }).optional(),
});
export const prepareCreatorToolOutputSchema = object({
  operationId: z.string(), quote,
  quoteId: z.string().optional(), toolId: toolId.optional(),
  operation: object({ toolId, profile, expectedDurationSec: z.number().nullable(), audioPolicy, sourceAssets: z.array(asset),
    outputTiming: object({ kind: z.literal('trim-generated-tail'), generatedDurationSec: z.number() }).optional(),
  }).optional(),
  kind: subtitleKind.optional(), state: subtitleState.optional(), jobId: z.string().nullable().optional(),
  result: result.nullable().optional(), subtitle: preparedSubtitle.optional(), exportEstimate: money.nullable().optional(),
});
export const creatorOperationOutputSchema = object({
  operationId: z.string(), jobId: z.string().nullable(), result: result.nullable(),
  retry: object({ afterSeconds: z.number().nullable() }),
  toolId: toolId.optional(), status: z.enum(['prepared', 'running', 'finalizing', 'completed', 'failed']).optional(),
  state: subtitleState.optional(), kind: subtitleKind.optional(), quote: quote.optional(),
  error: z.string().nullable().optional(), retryAfterSeconds: z.number().nullable().optional(),
  needsAttention: z.boolean().optional(), retryable: z.boolean().optional(),
  exportEstimate: money.nullable().optional(), subtitle: preparedSubtitle.optional(),
});
const style = object({
  preset: z.enum(['clean', 'active-word', 'high-contrast']), position: z.enum(['bottom', 'center', 'top']),
  fontSizePercent: z.number(), textColor: z.string(), accentColor: z.string(),
});
export const subtitleDocumentOutputSchema = object({ document: object({
  version: z.literal(1), id: z.string(), revision: z.number(), language: z.string(),
  source: object({ ref: asset, fingerprint: z.string(), durationMs: z.number(),
    sequenceMix: object({ sequenceId: z.string(), revision: z.number(), audioManifestHash: z.string() }).optional(),
  }),
  words: z.array(object({ id: z.string(), text: z.string(), startMs: z.number(), endMs: z.number(), speakerId: z.string().optional() })),
  segments: z.array(object({ id: z.string(), text: z.string(), startMs: z.number(), endMs: z.number(),
    wordIds: strings, alignment: z.enum(['aligned', 'edited']),
  })), style,
}) });
export const exportSubtitleTextOutputSchema = object({
  documentId: z.string(), revision: z.number(), format: z.enum(['srt', 'vtt']), filename: z.string(), text: z.string(),
});
