import type {NextRequest} from 'next/server';
import {handlePromptAnalysis} from '@/server/prompt-assistance/analysis-route-handler';
export const runtime='nodejs';
export const maxDuration=400;
export async function GET(request:NextRequest){return handlePromptAnalysis(request);}
export async function POST(request:NextRequest){return handlePromptAnalysis(request);}
