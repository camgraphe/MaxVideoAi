import type { NextRequest } from 'next/server';
import { handleStudioCharacters } from '../../../_lib/studio-character-handler';

export const runtime = 'nodejs';
type Context = {params:Promise<{projectId:string}>};

export async function GET(req:NextRequest,{params}:Context) {
  return handleStudioCharacters(req,(await params).projectId,'read');
}

export async function POST(req:NextRequest,{params}:Context) {
  return handleStudioCharacters(req,(await params).projectId,'select');
}
