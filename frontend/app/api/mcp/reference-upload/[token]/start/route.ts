import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import {
  MCP_REFERENCE_PRODUCTION_STORAGE_PREFIX,
  createReferenceUploadStartHandler,
} from '@/server/uploads/create-reference-direct-upload-handlers';

export const runtime = 'nodejs';

export const POST = createReferenceUploadStartHandler({
  isEnabled: (request) => resolveMcpRuntimeCapabilities(
    process.env,
    getMcpRequestHost(request.headers),
  ).referenceUploads,
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
