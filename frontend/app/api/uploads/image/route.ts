import { createImageUploadPostHandler } from '@/server/uploads/create-image-upload-post-handler';

export const runtime = 'nodejs';

export const POST = createImageUploadPostHandler();
