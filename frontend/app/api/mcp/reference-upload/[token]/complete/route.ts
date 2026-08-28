import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import {
  createReferenceUploadCompleteHandler,
  createReferenceUploadOptionsHandler,
} from '@/server/uploads/create-reference-direct-upload-handlers';

export const runtime = 'nodejs';

const isEnabled = (request: Parameters<ReturnType<typeof createReferenceUploadCompleteHandler>>[0]) => (
  resolveMcpRuntimeCapabilities(process.env, getMcpRequestHost(request.headers)).referenceUploads
);

export const OPTIONS = createReferenceUploadOptionsHandler({ isEnabled });
export const POST = createReferenceUploadCompleteHandler({
  isEnabled,
});
