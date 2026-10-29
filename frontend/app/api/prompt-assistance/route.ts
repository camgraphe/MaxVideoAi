import type {NextRequest} from 'next/server';
import {handlePromptAssistance} from '@/server/prompt-assistance/route-handler';
export const runtime='nodejs';
export const maxDuration=120;
export async function GET(request:NextRequest){return handlePromptAssistance(request);}
export async function POST(request:NextRequest){return handlePromptAssistance(request);}
