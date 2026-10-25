import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { listOwnedGenerationSources } from '@/server/generations/owned-operation-sources';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest) {
  const {userId}=await getRouteAuthContext(request);
  if(!userId)return NextResponse.json({ok:false,error:'AUTH_REQUIRED'},{status:401,headers});
  const operation=request.nextUrl.searchParams.get('operation');
  if(operation!=='luma-extend'&&operation!=='flux-draft-enhance')return NextResponse.json({ok:false,error:'PARAMETER_INVALID'},{status:422,headers});
  try {return NextResponse.json({ok:true,...await listOwnedGenerationSources(userId,{operation,cursor:request.nextUrl.searchParams.get('cursor'),sourceJobId:request.nextUrl.searchParams.get('sourceJobId')})},{headers});}
  catch {return NextResponse.json({ok:false,error:'SOURCE_UNAVAILABLE'},{status:503,headers});}
}
