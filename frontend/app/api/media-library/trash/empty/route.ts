import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { requestLibraryTrashPurge } from '@/server/media-library/purge';
import { onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  const {userId}=await getRouteAuthContext(request);
  if(!userId)return organizationResponse({ok:false,error:'UNAUTHORIZED'},401);
  try{
    const body=await request.json(); onlyFields(body,['snapshotId','confirmation']);
    const result=await requestLibraryTrashPurge({userId,snapshotId:body.snapshotId as string,confirmation:body.confirmation as string});
    return organizationResponse({ok:true,...result},202);
  }catch(error){return organizationRouteError(error);}
}
