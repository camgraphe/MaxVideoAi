import type {NextRequest} from 'next/server';
import {handleStudioWorkerCron} from '../_lib/studio-worker-handler';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=400;
export async function GET(req:NextRequest){return handleStudioWorkerCron(req,'analysis');}
