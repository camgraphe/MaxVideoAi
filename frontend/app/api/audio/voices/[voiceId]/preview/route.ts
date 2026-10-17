import { NextResponse } from 'next/server';
import { resolveElevenVoicePreview } from '@/server/audio/eleven-voice-preview';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ voiceId: string }> }) {
  try {
    const { voiceId } = await context.params;
    const preview = await resolveElevenVoicePreview(voiceId);
    if (!preview) return NextResponse.json({ error: 'voice_preview_unavailable' }, { status: 404 });
    return NextResponse.redirect(preview, { status: 307, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'voice_preview_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
