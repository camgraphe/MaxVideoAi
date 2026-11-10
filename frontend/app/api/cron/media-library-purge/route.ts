import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/server/vercel-cron';
import { processLibraryPurgeBatch } from '@/server/media-library/purge-worker';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:NextRequest){
  if(process.env.VERCEL_ENV && process.env.VERCEL_ENV!=='production')return NextResponse.json({ok:false,error:'PRODUCTION_ONLY'},{status:503});
  const cronSecret=process.env.CRON_SECRET?.trim();
  if(!cronSecret)return NextResponse.json({ok:false,error:'CONFIGURATION_ERROR'},{status:503});
  const auth=authorizeCronRequest(request.headers,{cronSecret,deploymentId:process.env.VERCEL_DEPLOYMENT_ID,vercelEnv:process.env.VERCEL});
  if(!auth.ok)return NextResponse.json({ok:false,error:'UNAUTHORIZED'},{status:401});
  try{return NextResponse.json({ok:true,...await processLibraryPurgeBatch({limit:20})});}
  catch{return NextResponse.json({ok:false,error:'CLEANUP_RETRY'},{status:500});}
}
