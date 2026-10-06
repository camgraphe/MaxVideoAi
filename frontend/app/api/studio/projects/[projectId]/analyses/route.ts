import type {NextRequest} from 'next/server';
import {handleStudioAnalysis} from '../../../_lib/studio-analysis-handler';
export const runtime='nodejs';
type Context={params:Promise<{projectId:string}>};
export async function POST(req:NextRequest,context:Context){return handleStudioAnalysis(req,(await context.params).projectId,'prepare');}
