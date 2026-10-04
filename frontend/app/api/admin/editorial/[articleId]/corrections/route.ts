import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,AdminAuthError} from '@/server/admin';
import {requestEditorialCorrection} from '@/server/editorial/corrections';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{articleId:string}>}) {
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Forbidden origin'},{status:403});
 try {
  const admin=await requireAdmin(request);
  const {articleId}=await params;
  const raw=await request.text();if(Buffer.byteLength(raw)>8192)return NextResponse.json({error:'Request too large'},{status:413});
  const result=await requestEditorialCorrection({...JSON.parse(raw),articleId},admin);
  return NextResponse.json({...result,published:false});
 }catch(error){return NextResponse.json({error:'Correction not recorded'},{status:error instanceof AdminAuthError?error.status:409});}
}
