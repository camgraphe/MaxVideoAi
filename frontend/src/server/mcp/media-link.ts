import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {resolveMcpAcquisitionSigningSecret} from '@/lib/mcp-acquisition';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import {parseTrustedAccountUrl} from '@/server/agent-api/account-destinations';
import type {AgentPrincipal} from '@/server/agent-api/principal';
import type {AgentGenerationResult} from '@/server/generations/generation-status';
import {ownedMediaStorageKeyForUrl} from '@/server/storage';

const id = z.string().min(1).max(256);
const sourceSchema = z.union([
  z.object({type:z.literal('generation'),jobId:id}).strict(),
  z.object({type:z.literal('export'),exportId:id}).strict(),
  toolAssetRefSchema,
]);
const claimsSchema = z.object({
  v:z.literal(1),aud:z.string().url(),userId:id,clientId:id,source:sourceSchema,
  mediaHash:z.string().regex(/^[a-f0-9]{64}$/),iat:z.number().int().nonnegative(),exp:z.number().int().positive(),
}).strict();
export type McpMediaSource = z.infer<typeof sourceSchema>;
export type McpMediaClaims = z.infer<typeof claimsSchema>;
export const MCP_MEDIA_LINK_PATH = '/api/mcp/media';

function signature(payload:string):Buffer {
  // Separate this read capability from acquisition/OAuth approvals using the existing secret.
  const key = createHmac('sha256',resolveMcpAcquisitionSigningSecret()).update('mcp-media-read-v1:key').digest();
  return createHmac('sha256',key).update(`mcp-media-read-v1:${payload}`).digest();
}
export function mcpMediaHash(storageKey:string):string {
  return createHash('sha256').update(storageKey).digest('hex');
}
export function primaryGenerationMediaUrl(result:AgentGenerationResult|null):string|null {
  if(!result)return null;
  if(result.surface==='image')return result.imageUrls[0]??null;
  return result.surface==='audio' ? result.audioUrl??result.videoUrl : result.videoUrl;
}

function signedExpiry(url:string):number|null {
  const params = new URL(url).searchParams;
  const date = params.get('X-Amz-Date');
  const seconds = Number(params.get('X-Amz-Expires'));
  if(!date || !/^\d{8}T\d{6}Z$/.test(date) || !Number.isSafeInteger(seconds) || seconds<=0)return null;
  const start = Date.parse(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${date.slice(9,11)}:${date.slice(11,13)}:${date.slice(13,15)}Z`);
  return Number.isFinite(start) ? Math.floor(start/1000)+seconds : null;
}

/** An optional, short-lived bearer link for Markdown. Never replaces native original media. */
export function createMcpMediaLink(params:{
  principal:AgentPrincipal;origin:string;source:McpMediaSource;url:string;expiresAt?:string|null;
},now=Date.now()):string|null {
  try {
    if(params.principal.authMethod!=='oauth' || !params.principal.clientId)return null;
    const origin = parseTrustedAccountUrl(new URL('/account/connections',params.origin).href).origin;
    const key = ownedMediaStorageKeyForUrl({url:params.url,userId:params.principal.userId});
    if(!key)return null;
    const iat = Math.floor(now/1000);
    const explicitExpiry = params.expiresAt ? Math.floor(Date.parse(params.expiresAt)/1000) : Infinity;
    const exp = Math.min(iat+300,signedExpiry(params.url)??Infinity,explicitExpiry);
    if(!Number.isSafeInteger(exp) || exp<=iat)return null;
    const claims = claimsSchema.parse({v:1,aud:origin,userId:params.principal.userId,clientId:params.principal.clientId,
      source:params.source,mediaHash:mcpMediaHash(key),iat,exp});
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const link = new URL(MCP_MEDIA_LINK_PATH,origin);
    link.searchParams.set('token',`${payload}.${signature(payload).toString('base64url')}`);
    return link.href;
  } catch {
    // A missing/invalid existing secret must not break completed media or invent a public URL.
    return null;
  }
}

export function verifyMcpMediaToken(token:string,audience:string,now=Date.now()):McpMediaClaims|null {
  try {
    if(token.length>4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))return null;
    const [payload,mac] = token.split('.');
    const actual = Buffer.from(mac,'base64url');
    const expected = signature(payload);
    if(actual.length!==expected.length || !timingSafeEqual(actual,expected))return null;
    const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload,'base64url').toString('utf8')));
    const seconds = Math.floor(now/1000);
    if(claims.aud!==audience || claims.iat>seconds || claims.exp<=seconds || claims.exp<=claims.iat || claims.exp-claims.iat>300)return null;
    return claims;
  } catch {return null;}
}
