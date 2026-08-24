import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import { createReferenceUploadPostHandler } from '@/server/uploads/create-reference-upload-post-handler';

export const runtime = 'nodejs';

export const POST = createReferenceUploadPostHandler({
  isEnabled: (request) => resolveMcpRuntimeCapabilities(
    process.env,
    getMcpRequestHost(request.headers),
  ).referenceUploads,
});
