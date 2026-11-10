import { createHash } from 'node:crypto';
import type { OrganizationSource } from './organization-sources';
export function purgeSourceTokens(sources: Iterable<OrganizationSource>): string[] {
  return [...sources].flatMap(source=>[source.id,source.publicId,source.type==='job-output'?`output:${source.id}`:null,source.url,source.original]).filter((value):value is string=>Boolean(value));
}
export function purgeTokenHashes(values: string[]): string[] {
  const tokens=values.flatMap(value=>{
    if(!/^https:\/\//i.test(value))return[value];
    const normalized=value.split('?')[0].split('#')[0];
    try{return[normalized,`storage-path:${new URL(value).pathname.slice(1)}`];}
    catch{return[normalized];}
  });
  return [...new Set(tokens)].map(value=>createHash('sha256').update(value).digest('hex'));
}
