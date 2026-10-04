import { createImageUploadPostHandler } from '@/server/uploads/create-image-upload-post-handler';
import { createEditorialImageUploadHandler } from '@/server/editorial/media-upload-handler';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const uploadUserImage = createImageUploadPostHandler();
const uploadEditorialImage = createEditorialImageUploadHandler();

export function POST(request: NextRequest) {
  return request.headers.get('x-upload-purpose') === 'editorial-draft'
    ? uploadEditorialImage(request)
    : uploadUserImage(request);
}
