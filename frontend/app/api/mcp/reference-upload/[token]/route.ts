import { FEATURES } from '@/content/feature-flags';
import { createReferenceUploadPostHandler } from '@/server/uploads/create-reference-upload-post-handler';

export const runtime = 'nodejs';

export const POST = createReferenceUploadPostHandler({
  isEnabled: () => FEATURES.mcp.referenceUploads,
});
