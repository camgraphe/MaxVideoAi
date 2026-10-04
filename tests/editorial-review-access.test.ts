import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {reviewTokenHash,validateReviewAccess,assertReviewOrigin} from '../frontend/src/server/editorial/review-access';
const token=randomBytes(32).toString('base64url');
const grant={articleId:'00000000-0000-4000-8000-000000000000',version:1,digest:'a'.repeat(64),tokenHash:reviewTokenHash(token),expiresAt:new Date(Date.now()+60000).toISOString(),revoked:false};
test('review capability rejects missing, forged, expired and revoked access',()=>{
 assert.equal(validateReviewAccess(grant,token),true);
 for(const t of ['',token+'x',randomBytes(32).toString('base64url')])assert.equal(validateReviewAccess(grant,t),false);
 assert.equal(validateReviewAccess(grant,token,Date.now()+120000),false);
 assert.equal(validateReviewAccess({...grant,revoked:true},token),false);
});
test('mutations require the explicit review origin',()=>{
 assert.doesNotThrow(()=>assertReviewOrigin('https://review.example',['https://review.example']));
 for(const origin of [undefined,'null','https://evil.example','https://review.example.evil'])assert.throws(()=>assertReviewOrigin(origin,['https://review.example']));
});
