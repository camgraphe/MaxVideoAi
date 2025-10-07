import { NextResponse } from 'next/server';
import { enginesResponse } from '@/lib/engines';

export async function GET() {
  const response = await enginesResponse();
  return NextResponse.json(response);
}
