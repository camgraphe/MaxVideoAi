import { createHash } from 'node:crypto';
import { createBoundedMediaDownloader } from '@/server/bounded-media-download';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { withVideoExcerptSlot, VideoExcerptError, VIDEO_EXCERPT_PREPARATION_LIMITS } from '@/server/video-excerpts/media';
import { AgentApiError } from '@/server/agent-api/errors';

// Operational bound, shared with source inspection; not a supplier image-size claim.
const downloadImage = createBoundedMediaDownloader({accepted:['image/jpeg','image/png','image/webp','image/avif'],maxBytes:VIDEO_EXCERPT_PREPARATION_LIMITS.maxBytes});
/** Caller resolves the exact project output or owned promoted asset before requesting bytes. */
export async function hashH3PromotionImage(url:string,userId:string,dependencies={readUrl:createOwnedMediaReadUrl,download:downloadImage}):Promise<string> {
  try {
    return await withVideoExcerptSlot(userId,async()=>{
      const accessUrl=await dependencies.readUrl({url,userId,expiresInSeconds:300});
      const {bytes}=await dependencies.download({file_id:'h3-promotion-image',download_url:accessUrl});
      return createHash('sha256').update(bytes).digest('hex');
    });
  } catch(error) {
    if(error instanceof VideoExcerptError && error.code==='PREPARATION_BUSY') throw new AgentApiError('RATE_LIMITED',error.message,true);
    throw error;
  }
}
