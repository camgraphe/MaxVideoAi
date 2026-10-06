import type {NextRequest} from 'next/server';
import {handleStudioAnalysis} from '../../../../_lib/studio-analysis-handler';
export const runtime='nodejs';
export const maxDuration=400;
type Context={params:Promise<{projectId:string;analysisId:string}>};
export async function GET(req:NextRequest,context:Context){const params=await context.params;return handleStudioAnalysis(req,params.projectId,'read',params.analysisId);}
export async function POST(req:NextRequest,context:Context){const params=await context.params;return handleStudioAnalysis(req,params.projectId,'confirm',params.analysisId);}
