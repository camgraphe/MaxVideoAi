import { createHash } from 'node:crypto';
import { redactReviewText } from '@/server/admin-studio-review/projection';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ReviewProjection = { value: Json; truncated: boolean; omitted: number };
const privateKey = /authorization|password|secret|credential|encrypted|api[_-]?key|access[_-]?token|refresh[_-]?token|^token$|^(?:set[-_]?)?cookie$|(^|_)(url|uri)$|(?:Url|Uri)$|^b64_json$/i;
const referenceToken = /^(?:@(Image|Video|Audio)[1-9]\d{0,3}|<IMAGE_\d{1,4}>)$/;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Bounded customer-content projection, not anonymization. Never use for public analytics. */
export function projectReviewData(input: unknown, maxBytes = 160_000): ReviewProjection {
  let remaining = maxBytes, nodes = 0, omitted = 0, truncated = false;
  function text(value: string): string {
    const bounded = value.slice(0, 160_000);
    if (bounded.length < value.length) truncated = true;
    const safe = redactReviewText(bounded, 160_000) ?? '';
    const bytes = Buffer.from(safe);
    const kept = bytes.subarray(0, Math.max(0, remaining)).toString('utf8');
    if (bytes.length > remaining) truncated = true;
    remaining -= Buffer.byteLength(kept);
    return kept;
  }
  function visit(value: unknown, depth: number): Json {
    if (++nodes > 4000 || remaining <= 0 || depth > 14) { truncated = true; return '[truncated]'; }
    if (value === null || typeof value === 'boolean') return value;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      // Tool arguments/results and project facts sometimes arrive as JSON strings.
      if (value.length <= 160_000 && /^[\[{]/.test(value.trim())) {
        try { return visit(JSON.parse(value), depth + 1); } catch { /* Ordinary prose. */ }
      }
      return text(value);
    }
    if (Array.isArray(value)) {
      if (value.length > 128) truncated = true;
      return value.slice(0, 128).map(item => visit(item, depth + 1));
    }
    if (value && typeof value === 'object') {
      const source = record(value);
      if (source.type === 'reasoning') { omitted++; return '[reasoning omitted]'; }
      if (['input_image','input_audio','input_file'].includes(String(source.type))) { omitted++; return { type: String(source.type), mediaOmitted: true }; }
      if(source.truncated===true || typeof source.reviewOmission==='string')truncated=true;
      const result: Record<string, Json> = {};
      const entries = Object.entries(source);
      if (entries.length > 128) truncated = true;
      for (const [key, child] of entries.slice(0, 128)) {
        // Only the known provider mention syntax can survive a generic token field.
        const isReferenceToken = key === 'token' && typeof child === 'string' && referenceToken.test(child);
        if (privateKey.test(key) && !isReferenceToken) { omitted++; continue; }
        // Only schema-shaped keys; do not let a hostile property name bypass text scrubbing.
        if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) { omitted++; continue; }
        result[key] = /^(instructionsHash|toolsHash|responseFormatHash)$/.test(key) && typeof child === 'string' && /^[a-f0-9]{64}$/.test(child) ? child : visit(child, depth + 1);
      }
      return result;
    }
    omitted++; return null;
  }
  return { value: visit(input, 0), truncated, omitted };
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
export function buildAssistantReviewContext(params: object) {
  const p = record(params);
  const input = projectReviewData(p.input);
  const media = { images: 0, audio: 0, files: 0 };
  // Count media without retaining URLs, base64, or trying to decode provider pixels.
  for (const item of Array.isArray(p.input) ? p.input : []) {
    for (const part of Array.isArray(record(item).content) ? record(item).content as unknown[] : []) {
      const type = record(part).type;
      if (type === 'input_image') media.images++;
      if (type === 'input_audio') media.audio++;
      if (type === 'input_file') media.files++;
    }
  }
  return { version: 'assistant-input-v1', capturePoint: 'before_dispatch', capturedAt: new Date().toISOString(),
    model: typeof p.model === 'string' ? p.model : null,
    reasoning: typeof record(p.reasoning).effort === 'string' ? record(p.reasoning).effort : null,
    maxOutputTokens: typeof p.max_output_tokens === 'number' ? p.max_output_tokens : null,
    instructionsHash: hash(p.instructions), toolsHash: hash(p.tools), responseFormatHash: hash(p.text),
    instructions: projectReviewData(p.instructions, 32_000), toolSchema: projectReviewData(p.tools, 64_000), responseFormat: projectReviewData(p.text, 16_000), input, media,
    toolNames: (Array.isArray(p.tools) ? p.tools : []).slice(0, 128).map(tool => redactReviewText(record(tool).name, 128)).filter(Boolean),
    coverage: 'redacted_text_and_media_counts',
  };
}
