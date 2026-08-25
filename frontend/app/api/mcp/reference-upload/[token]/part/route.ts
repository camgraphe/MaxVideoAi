import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import { createReferenceUploadPartHandler } from '@/server/uploads/create-reference-direct-upload-handlers';

export const runtime = 'nodejs';

export const POST = createReferenceUploadPartHandler({
  isEnabled: (request) => resolveMcpRuntimeCapabilities(
    process.env,
    getMcpRequestHost(request.headers),
  ).referenceUploads,
});
