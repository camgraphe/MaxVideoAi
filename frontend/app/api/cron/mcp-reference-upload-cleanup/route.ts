import { createMcpReferenceUploadCleanupHandler } from './_lib/cleanup-handler';

export const runtime = 'nodejs';

const handle = createMcpReferenceUploadCleanupHandler();
export { handle as GET, handle as POST };
