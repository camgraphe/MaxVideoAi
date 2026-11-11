import * as z from 'zod/v4';
import { AGENT_API_ERROR_CODES } from '@/server/agent-api/errors';
import type { McpDistributionProfile } from '@/server/mcp/distribution-profile';

const toolFailure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(AGENT_API_ERROR_CODES), message: z.string(), retryable: z.boolean(),
    nextAction: z.record(z.string(), z.unknown()).nullable(),
    correlationId: z.string().optional(),
  }).passthrough(),
}).passthrough();
const failureJson = z.toJSONSchema(toolFailure);
const projected = new WeakMap<z.ZodObject, z.ZodObject>();

/** Keep server success validation strict, while advertising both wire results.
 * SDK clients validate structuredContent even when isError is true. Zod metadata
 * supplies the JSON Schema alternative without changing parsing or returned data.
 */
export function withToolErrorOutput<T extends z.ZodObject>(
  success: T,
  profile: McpDistributionProfile = 'openai-directory',
): T {
  if (profile !== 'openai-directory') return success;
  const cached = projected.get(success);
  if (cached) return cached as T;
  const successJson = z.toJSONSchema(success);
  const result = success.meta({
    properties: { ...successJson.properties, ...failureJson.properties },
    required: [],
    additionalProperties: true,
    anyOf: [successJson, failureJson],
  });
  projected.set(success, result);
  return result;
}
