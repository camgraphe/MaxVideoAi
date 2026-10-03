import type {NextRequest} from 'next/server';
import {handleStudioAssistance} from '../_lib/studio-assistance-handler';
export const runtime = 'nodejs';
export async function GET(req:NextRequest){return handleStudioAssistance(req,'read');}
export async function POST(req:NextRequest){return handleStudioAssistance(req,'choose');}
