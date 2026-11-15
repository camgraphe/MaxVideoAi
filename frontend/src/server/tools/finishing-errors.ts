import { isToolFailureCode, type ToolFailureCode } from '@/lib/toolbox/errors';
import { ToolMediaValidationError } from './tool-media-errors';

export class FinishingExecutionError extends Error {
  constructor(readonly code: ToolFailureCode, readonly refunded = false) { super(code); this.name = 'FinishingExecutionError'; }
}

export function finishingProviderFailureCode(error: unknown): ToolFailureCode {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (!value || typeof value !== 'object' || depth > 5) continue;
    if (Array.isArray(value)) { queue.push(...value.slice(0, 20).map(value => ({ value, depth: depth + 1 }))); continue; }
    const record = value as Record<string, unknown>;
    if (record.type === 'content_policy_violation') return 'TOOL_CONTENT_BLOCKED';
    for (const key of ['body', 'detail', 'error', 'errors', 'payload']) queue.push({ value: record[key], depth: depth + 1 });
  }
  return 'TOOL_PROVIDER_FAILED';
}

export function finishingOutputFailureCode(error: unknown): ToolFailureCode {
  return error instanceof ToolMediaValidationError || error instanceof Error && /^(?:Invalid output metadata|Unexpected output (?:duration|audio presence|frame rate|dimensions|resolution|aspect ratio)|Missing output resolution|Tool output size is invalid)\.$/.test(error.message)
    ? 'TOOL_OUTPUT_INVALID' : 'TOOL_OUTPUT_SAVE_FAILED';
}

export function storedFinishingFailureCode(message: unknown): ToolFailureCode {
  if (isToolFailureCode(message)) return message;
  if (message === 'Unable to preserve the tool result.') return 'TOOL_OUTPUT_SAVE_FAILED';
  if (message === 'Provider processing failed.') return 'TOOL_PROVIDER_FAILED';
  if (message === 'Submission interrupted.') return 'TOOL_SUBMISSION_INTERRUPTED';
  return 'TOOL_RUN_FAILED';
}
