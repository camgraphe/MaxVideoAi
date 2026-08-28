import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import {
  MCP_REFERENCE_PRODUCTION_STORAGE_PREFIX,
  createReferenceUploadOptionsHandler,
  createReferenceUploadStartHandler,
} from '@/server/uploads/create-reference-direct-upload-handlers';

export const runtime = 'nodejs';

const isEnabled = (request: Parameters<ReturnType<typeof createReferenceUploadStartHandler>>[0]) => (
  resolveMcpRuntimeCapabilities(process.env, getMcpRequestHost(request.headers)).referenceUploads
);

export const OPTIONS = createReferenceUploadOptionsHandler({ isEnabled });
export const POST = createReferenceUploadStartHandler({
  isEnabled,
  getStoragePrefix: (request) => {
    const requestHost = getMcpRequestHost(request.headers);
    const stagingHost = process.env.MCP_STAGING_HOST?.trim().toLowerCase();
    if (stagingHost && requestHost === stagingHost) {
      return process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX
        ?? MCP_REFERENCE_PRODUCTION_STORAGE_PREFIX;
    }
    return MCP_REFERENCE_PRODUCTION_STORAGE_PREFIX;
  },
});
