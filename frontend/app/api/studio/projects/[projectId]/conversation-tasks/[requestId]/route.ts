import type {NextRequest} from 'next/server';
import {handleStudioTask} from '../../../../_lib/studio-task-handler';
export const runtime='nodejs';
type Context={params:Promise<{projectId:string;requestId:string}>};
export async function GET(req:NextRequest,context:Context){const {projectId,requestId}=await context.params;return handleStudioTask(req,projectId,requestId,'read');}
export async function POST(req:NextRequest,context:Context){const {projectId,requestId}=await context.params;return handleStudioTask(req,projectId,requestId,'mutate');}
