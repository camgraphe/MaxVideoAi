import type {NextRequest} from 'next/server';
import {handlePromptAssistanceWorkerCron} from '../_lib/prompt-assistance-worker-handler';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=800;
export async function GET(req:NextRequest){return handlePromptAssistanceWorkerCron(req);}
