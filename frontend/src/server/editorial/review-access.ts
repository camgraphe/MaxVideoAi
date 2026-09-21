import {createHash, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const reviewGrantSchema=z.object({
  articleId:z.string().uuid(),version:z.number().int().positive(),digest:z.string().regex(/^[a-f0-9]{64}$/),
  tokenHash:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.string().datetime(),revoked:z.boolean().default(false),
}).strict();
export type ReviewGrant=z.infer<typeof reviewGrantSchema>;
export const reviewTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function validateReviewAccess(grant:ReviewGrant,token:string,now=Date.now()) {
  if(grant.revoked || Date.parse(grant.expiresAt)<=now || !/^[A-Za-z0-9_-]{43}$/.test(token))return false;
  return timingSafeEqual(Buffer.from(grant.tokenHash,'hex'),Buffer.from(reviewTokenHash(token),'hex'));
}
export function assertReviewOrigin(origin:string|undefined,allowed:string[]) {
  if(!origin || !allowed.includes(origin))throw Error('Forbidden origin');
}
